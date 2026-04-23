import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { esporteId } = useParams();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMinhasLigas() {
      setLoading(true);
      try {
        // 1. Pega o usuário do Auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Busca o ID numérico (int8) na sua tabela public.users usando o email
        // Isso resolve o erro de sintaxe bigint que apareceu no seu console
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (userError || !userData) {
          console.error("Usuário não encontrado na tabela public.users");
          setLoading(false);
          return;
        }

        const numericUserId = userData.id;

        // 3. Busca participações usando o ID numérico correto
        const { data: participacoes, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_league_id')
          .eq('user_id', numericUserId);

        if (errMembros || !participacoes?.length) {
          setLigas([]);
          return;
        }

        const idsDasLigas = participacoes.map(p => p.user_league_id);

        // 4. Busca as ligas e filtra pelo sport_id (NHL = 2)
        const { data: ligasEncontradas, error: errLigas } = await supabase
          .from('user_leagues')
          .select(`
            id,
            name,
            leagues!official_league_id (
              sport_id
            )
          `)
          .in('id', idsDasLigas);

        if (errLigas) throw errLigas;

        // Filtro garantindo que comparamos strings com strings
        const filtradas = ligasEncontradas.filter(liga => 
          String(liga.leagues?.sport_id) === String(esporteId)
        );

        setLigas(filtradas);

      } catch (err) {
        console.error("Erro técnico:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic hover:bg-[#26283A] transition-all">
          ← VOLTAR
        </Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Minhas Ligas <span className="text-[#0077FF]">{esporteId === '2' ? 'HOCKEY' : 'FUTEBOL'}</span>
        </h1>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center animate-pulse font-black opacity-50 uppercase text-xs">Sincronizando iChute...</p>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/predictions/${liga.id}`} // Redireciona direto para a sua página de Predictions
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{liga.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase">PALPITAR</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-gray-600 text-[10px] mt-4 leading-relaxed uppercase">
              Confira se o seu email de login está na tabela 'users' com o ID numérico correspondente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}