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
        // 1. Pegamos o usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Buscamos em quais ligas o usuário 2 está inscrito
        const { data: participacoes, error: err1 } = await supabase
          .from('user_league_members')
          .select('user_league_id')
          .eq('user_id', user.id);

        if (err1 || !participacoes.length) {
          setLigas([]);
          return;
        }

        const idsDasLigas = participacoes.map(p => p.user_league_id);

        // 3. Buscamos os detalhes dessas ligas E o sport_id da liga oficial
        // Usamos a sintaxe correta para a sua FK: leagues!official_league_id
        const { data: ligasEncontradas, error: err2 } = await supabase
          .from('user_leagues')
          .select(`
            id,
            name,
            official_league_id,
            leagues!official_league_id (
              sport_id
            )
          `)
          .in('id', idsDasLigas);

        if (err2) throw err2;

        // 4. Filtramos pelo esporte da URL (Futebol=1, Hockey=2)
        const filtradas = ligasEncontradas.filter(liga => {
          const sId = liga.leagues?.sport_id;
          return String(sId) === String(esporteId);
        });

        setLigas(filtradas);

      } catch (err) {
        console.error("Erro fatal:", err.message);
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
          <p className="text-center animate-pulse font-black opacity-50 uppercase text-xs">Cruzando dados...</p>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] hover:bg-[#1e2145] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{liga.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase">Entrar</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-gray-600 text-[10px] mt-4 leading-relaxed uppercase">
              O sistema buscou por Esporte ID: {esporteId} <br/>
              Confirme se a NHL na tabela 'leagues' tem sport_id = 2.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}