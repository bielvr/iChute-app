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

        // BUSCA EM DUAS ETAPAS PARA MATAR O PROBLEMA DE JOIN
        // 1. Pegamos os IDs das ligas onde o cara é membro (User ID 2)
        const { data: membros, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_league_id')
          .eq('user_id', user.id);

        if (errMembros || !membros.length) {
          setLigas([]);
          return;
        }

        const idsLigas = membros.map(m => m.user_league_id);

        // 2. Buscamos os dados das ligas e o sport_id da oficial de forma explícita
        // Usamos !official_league_id para FORÇAR o Supabase a usar a coluna certa
        const { data: ligasEncontradas, error: errLigas } = await supabase
          .from('user_leagues')
          .select(`
            id,
            name,
            leagues!official_league_id (
              sport_id
            )
          `)
          .in('id', idsLigas);

        if (errLigas) throw errLigas;

        // Filtro manual para garantir 100% de precisão (Hockey = 2, Futebol = 1)
        const filtradas = ligasEncontradas.filter(liga => {
          const sId = liga.leagues?.sport_id;
          return String(sId) === String(esporteId);
        });

        setLigas(filtradas);

      } catch (err) {
        console.error("Erro na integração:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId, supabase]);

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
          <p className="text-center animate-pulse font-black opacity-50 uppercase text-xs">Validando com iChute...</p>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] hover:bg-[#1e2145] transition-all group"
            >
              <span className="font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{liga.name}</span>
              <div className="flex items-center gap-2 text-[#0077FF]">
                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 uppercase">Acessar</span>
                <span className="font-bold">→</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-500 font-black italic uppercase text-sm font-black">Nada por aqui</p>
            <p className="text-gray-600 text-[10px] mt-4 leading-relaxed uppercase">
              URL ID: {esporteId} | Usuário: Conectado <br/>
              A liga "{esporteId === '2' ? 'Dedo no gelo' : 'Brasileirão'}" deve estar no banco.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}