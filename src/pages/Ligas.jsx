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

        // O segredo está aqui: explicitamos a relação através da FK 'official_league_id'
        const { data, error } = await supabase
          .from('user_league_members')
          .select(`
            user_league_id,
            user_leagues!inner (
              id,
              name,
              official_league_id,
              leagues!official_league_id (
                sport_id
              )
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          // Filtramos garantindo que a comparação ignore tipos (string vs number)
          const filtradas = data
            .filter(item => {
              const sportIdBanco = item.user_leagues?.leagues?.sport_id;
              return String(sportIdBanco) === String(esporteId);
            })
            .map(item => ({
              id: item.user_leagues.id,
              name: item.user_leagues.name
            }));
          
          setLigas(filtradas);
        }
      } catch (err) {
        console.error("Erro na busca das ligas:", err.message);
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
          <p className="text-center animate-pulse font-black opacity-50 uppercase text-xs">Buscando dados...</p>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] hover:bg-[#1e2145] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{liga.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase transition-opacity">Entrar</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-gray-600 text-[10px] mt-2 leading-relaxed uppercase">
              Verifique se a sua liga no banco aponta para o ID de esporte correto.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}