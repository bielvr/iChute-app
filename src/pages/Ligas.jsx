import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  // Ajustado para 'sportId' para bater com a rota do App.jsx
  const { sportId } = useParams(); 
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Força a comparação correta para o título
  const nomeEsporte = String(sportId) === '2' ? 'HOCKEY' : 'FUTEBOL';

  useEffect(() => {
    async function fetchMinhasLigas() {
      setLoading(true);
      try {
        // 1. Pega o usuário logado no Auth (UUID)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Busca o ID numérico (int8) na sua tabela 'users'
        // Fundamental para evitar o erro de bigint no console
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (userError || !userData) {
          console.error("Usuário não mapeado na tabela public.users");
          setLoading(false);
          return;
        }

        const numericUserId = userData.id;

        // 3. Busca na 'user_league_members' usando o ID numérico
        const { data: participacoes, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_league_id')
          .eq('user_id', numericUserId);

        if (errMembros || !participacoes?.length) {
          setLigas([]);
          setLoading(false);
          return;
        }

        const idsDasLigas = participacoes.map(p => p.user_league_id);

        // 4. Busca as ligas e faz o join com 'leagues' para validar o esporte
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

        // Filtro final garantindo que o sport_id bate com o da URL
        const filtradas = ligasEncontradas.filter(liga => 
          String(liga.leagues?.sport_id) === String(sportId)
        );

        setLigas(filtradas);

      } catch (err) {
        console.error("Erro técnico iChute:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (sportId) fetchMinhasLigas();
  }, [sportId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/home" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic hover:bg-[#26283A] transition-all">
          ← VOLTAR
        </Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Minhas Ligas <span className="text-[#0077FF]">{nomeEsporte}</span>
        </h1>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#0077FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-center animate-pulse font-black opacity-50 uppercase text-[10px]">Sincronizando iChute...</p>
          </div>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/predictions/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{liga.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase italic">PALPITAR</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga de {nomeEsporte}</p>
            <p className="text-gray-600 text-[9px] mt-4 leading-relaxed uppercase font-bold">
              Verifique se sua conta está vinculada a uma liga de {nomeEsporte} no banco de dados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}