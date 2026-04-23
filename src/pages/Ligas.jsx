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
        // 1. Pega o usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Busca simplificada: pega as ligas do usuário e os dados da liga oficial
        // Sem tentar fazer o join triplo que está quebrando
        const { data, error } = await supabase
          .from('user_league_members')
          .select(`
            user_leagues (
              id,
              name,
              official_league_id,
              leagues (
                id,
                sport_id
              )
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          // 3. Filtro manual no JavaScript para garantir que não escape nada
          // Comparamos o sport_id da tabela 'leagues' com o esporteId da URL
          const filtradas = data
            .filter(item => {
              const ligaOficial = item.user_leagues?.leagues;
              // Forçamos ambos a virarem String para evitar erro de tipo (2 vs "2")
              return String(ligaOficial?.sport_id) === String(esporteId);
            })
            .map(item => item.user_leagues);
          
          setLigas(filtradas);
        }
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
          <div className="text-center py-10">
            <div className="w-8 h-8 border-4 border-[#0077FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-black italic opacity-50 uppercase text-xs">Sincronizando iChute...</p>
          </div>
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
              ID de Esporte Selecionado: {esporteId} <br/>
              Verifique se na tabela "leagues", o sport_id da liga 14 é "2".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}