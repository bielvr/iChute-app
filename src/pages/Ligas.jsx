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
        // 1. Pega o usuário logado (User ID: 2 no seu caso)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Busca as participações do usuário com os dados da liga e o sport_id oficial
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
          // 3. Filtro manual: Compara o sport_id da liga oficial com o da URL
          // Se a URL for /ligas/2 (Hockey), ele busca sport_id 2 no banco
          const filtradas = data
            .filter(item => {
              const sId = item.user_leagues?.leagues?.sport_id;
              return String(sId) === String(esporteId);
            })
            .map(item => ({
              id: item.user_leagues.id,
              name: item.user_leagues.name
            }));
          
          setLigas(filtradas);
        }
      } catch (err) {
        console.error("Erro ao carregar ligas:", err.message);
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
          <div className="text-center py-10 opacity-50 font-black italic uppercase text-xs animate-pulse">
            Sincronizando com o banco...
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
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase transition-opacity">Entrar</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-gray-600 text-[10px] mt-4 leading-relaxed uppercase">
              Verifique se a liga "{esporteId === '2' ? 'Dedo no gelo e gritaria' : 'Palpitômetro'}" <br/>
              está vinculada ao esporte correto no banco de dados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}