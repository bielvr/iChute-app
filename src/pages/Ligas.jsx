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
        // 1. Pega o usuário logado (User ID: 2 no seu banco)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Busca em quais ligas o usuário está inscrito
        const { data: participacoes, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_league_id')
          .eq('user_id', user.id);

        if (errMembros || !participacoes?.length) {
          setLigas([]);
          return;
        }

        const idsDasLigas = participacoes.map(p => p.user_league_id);

        // 3. Busca os detalhes das ligas usando a FK explícita 'official_league_id'
        // Isso resolve o problema de o Supabase não saber qual caminho seguir
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

        // 4. Filtro manual para garantir match de tipos (Hockey=2, Futebol=1)
        const filtradas = ligasEncontradas.filter(liga => {
          const sId = liga.leagues?.sport_id;
          return String(sId) === String(esporteId);
        }).map(liga => ({
          id: liga.id,
          name: liga.name
        }));

        setLigas(filtradas);

      } catch (err) {
        console.error("Erro no iChute:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="mb-10 mt-4 flex items-center gap-4">
        {/* Link simples, o Router já deve estar no topo do seu App */}
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
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] hover:bg-[#1e2145] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{liga.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase">Acessar</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-gray-600 text-[10px] mt-4 leading-relaxed uppercase">
              Esporte ID: {esporteId} | Banco de Dados OK
            </p>
          </div>
        )}
      </div>
    </div>
  );
}