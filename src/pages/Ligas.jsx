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
        // 1. Pega o usuário logado (necessário para filtrar user_league_members)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error("Usuário não autenticado");
          setLoading(false);
          return;
        }

        // 2. Query seguindo a hierarquia exata do seu print:
        // user_league_members -> user_leagues -> leagues -> sport_id
        const { data, error } = await supabase
          .from('user_league_members')
          .select(`
            user_id,
            user_leagues!inner (
              id,
              name,
              official_league_id,
              leagues!inner (
                sport_id
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('user_leagues.leagues.sport_id', esporteId);

        if (error) throw error;

        // 3. Mapeia os dados para facilitar o render
        if (data) {
          const formatadas = data.map(item => ({
            id: item.user_leagues.id,
            name: item.user_leagues.name
          }));
          setLigas(formatadas);
        }

      } catch (err) {
        console.error("Erro técnico na busca:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic hover:bg-[#26283A] transition-colors">
          ← VOLTAR
        </Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Minhas Ligas <span className="text-[#0077FF]">{esporteId === '1' ? 'FUTEBOL' : 'HOCKEY'}</span>
        </h1>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-2 opacity-50">
            <div className="w-8 h-8 border-4 border-[#0077FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-black italic text-xs uppercase">Buscando no Banco...</p>
          </div>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] hover:bg-[#1e2145] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">
                {liga.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 transition-opacity">ENTRAR</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-gray-600 text-[10px] mt-2 leading-relaxed">
              VOCÊ PRECISA ESTAR VINCULADO A UMA LIGA DE <br/>
              {esporteId === '1' ? 'FUTEBOL' : 'HOCKEY'} NA TABELA USER_LEAGUE_MEMBERS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}