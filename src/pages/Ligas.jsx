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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Query ajustada para as colunas exatas dos seus prints
        const { data, error } = await supabase
          .from('user_league_members')
          .select(`
            user_leagues (
              id,
              name,
              official_league_id,
              leagues (
                sport_id
              )
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          // Filtro manual para garantir comparação entre String e Number
          const filtradas = data
            .filter(item => {
              const sportIdNoBanco = item.user_leagues?.leagues?.sport_id;
              return String(sportIdNoBanco) === String(esporteId);
            })
            .map(item => item.user_leagues);
          
          setLigas(filtradas);
        }
      } catch (err) {
        console.error("Erro:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic">← VOLTAR</Link>
        <h1 className="text-2xl font-black italic uppercase">
          Minhas Ligas <span className="text-[#0077FF]">{esporteId === '2' ? 'HOCKEY' : 'FUTEBOL'}</span>
        </h1>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center animate-pulse opacity-50 font-black">CARREGANDO...</p>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF]">{liga.name}</span>
              <span className="text-[10px] font-black opacity-50 bg-[#26283A] px-3 py-1 rounded-full">ENTRAR</span>
            </Link>
          ))
        ) : (
          <div className="text-center p-10 border border-dashed border-gray-800 rounded-[30px]">
            <p className="text-gray-500 italic text-sm font-bold">NENHUMA LIGA DE {esporteId === '2' ? 'HOCKEY' : 'FUTEBOL'} ENCONTRADA</p>
          </div>
        )}
      </div>
    </div>
  );
}