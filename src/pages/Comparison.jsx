import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

export default function Comparison() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [palpitesMatriz, setPalpitesMatriz] = useState({}); // { matchId: { userId: { home, away, points } } }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Pegar membros da liga (baseado na sua tabela de membros/users)
        const { data: membros } = await supabase
          .from('user_leagues_members')
          .select('user_id, users(name)')
          .eq('user_league_id', ligaId);
        
        const listaUsers = membros?.map(m => ({ id: m.user_id, name: m.users.name })) || [];
        setUsuarios(listaUsers);

        // 2. Pegar os jogos da liga oficial vinculada
        const { data: ligaInfo } = await supabase
          .from('user_leagues')
          .select('official_league_id')
          .eq('id', ligaId)
          .single();

        const { data: matches } = await supabase
          .from('matches')
          .select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
          .eq('league_id', ligaInfo.official_league_id)
          .order('date', { ascending: false }); // Mostrar os mais recentes/futuros primeiro
        
        setJogos(matches || []);

        // 3. Buscar TODOS os palpites desta liga específica
        const { data: allPreds } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_league_id', ligaId);

        // Transformar em matriz para busca rápida: matriz[jogoId][userId]
        const matriz = {};
        allPreds?.forEach(p => {
          if (!matriz[p.match_id]) matriz[p.match_id] = {};
          matriz[p.match_id][p.user_id] = {
            home: p.prediction_home,
            away: p.prediction_away,
            points: p.points_earned
          };
        });
        setPalpitesMatriz(matriz);

      } catch (err) {
        console.error("Erro Comparison:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [ligaId]);

  if (loading) return <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center font-black italic text-[#0077FF] animate-pulse uppercase">Comparando resultados...</div>;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-32 font-sans">
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-8">
        <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] px-4 py-2 rounded-xl text-[10px] font-black border border-[#26283A]">← VOLTAR</button>
        <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter">Comparativo</h1>
      </header>

      <div className="max-w-5xl mx-auto overflow-x-auto no-scrollbar shadow-2xl rounded-[30px] border border-[#26283A]">
        <table className="w-full text-left bg-[#1A1C3A] border-collapse">
          <thead>
            <tr className="bg-[#0A0E2A]">
              <th className="p-5 text-[10px] font-black uppercase opacity-40 sticky left-0 bg-[#0A0E2A] z-10">Confronto</th>
              {usuarios.map(u => (
                <th key={u.id} className="p-5 text-[10px] font-black uppercase text-[#0077FF] text-center border-l border-[#26283A] min-w-[100px]">
                  {u.name.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jogos.map(jogo => (
              <tr key={jogo.id} className="border-t border-[#26283A] hover:bg-[#26283A]/30 transition-colors">
                <td className="p-5 sticky left-0 bg-[#1A1C3A] z-10 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <img src={jogo.home?.url_logo} className="w-6 h-6 object-contain" alt="" />
                      <span className="text-[12px] font-black mt-1">{jogo.home_score ?? '-'}</span>
                    </div>
                    <span className="text-[10px] opacity-20 font-black">X</span>
                    <div className="flex flex-col items-center">
                      <img src={jogo.away?.url_logo} className="w-6 h-6 object-contain" alt="" />
                      <span className="text-[12px] font-black mt-1">{jogo.away_score ?? '-'}</span>
                    </div>
                  </div>
                </td>

                {usuarios.map(u => {
                  const p = palpitesMatriz[jogo.id]?.[u.id];
                  const cravou = p && jogo.status === 'FINISHED' && p.home === jogo.home_score && p.away === jogo.away_score;
                  
                  return (
                    <td key={u.id} className={`p-5 text-center border-l border-[#26283A] ${cravou ? 'bg-[#0077FF]/10' : ''}`}>
                      {p ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-black italic ${cravou ? 'text-[#0077FF]' : 'text-white'}`}>
                            {p.home}x{p.away}
                          </span>
                          {p.points > 0 && (
                            <span className="bg-[#0077FF] text-white text-[8px] px-2 py-0.5 rounded-full font-black">
                              +{p.points} PTS
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] opacity-10 font-black italic">N/A</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BottomNav />
      <style dangerouslySetInnerHTML={{__html: `.no-scrollbar::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
}