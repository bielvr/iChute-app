import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Adicionado Link
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';

export default function Ranking() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  
  // Estados de navegação e controle
  const [activeTab, setActiveTab] = useState('liga'); // 'liga' ou 'global'
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [sportId, setSportId] = useState(null); // Estado para o ID da modalidade
  
  // Estados - Ranking da Liga
  const [rankingLiga, setRankingLiga] = useState([]);
  const [temporadasDisponiveis, setTemporadasDisponiveis] = useState([]);
  const [temporadaSelecionada, setTemporadaSelecionada] = useState("");

  // Estados - Ranking Global
  const [rankingGlobal, setRankingGlobal] = useState([]);

  useEffect(() => {
    async function fetchInitialSetup() {
      if (!ligaId) return;
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
          if (userData) setCurrentUserId(userData.id);
        }

        // Pega as temporadas e o sport_id da liga atual
        const { data: userLeagueInfo } = await supabase
          .from('user_leagues')
          .select(`
            official_league_id,
            leagues:official_league_id (sport_id)
          `)
          .eq('id', ligaId)
          .single();

        if (userLeagueInfo) {
          if (userLeagueInfo.leagues) {
            setSportId(userLeagueInfo.leagues.sport_id);
          }

          const { data: seasonsData } = await supabase
            .from('matches')
            .select('season')
            .eq('league_id', userLeagueInfo.official_league_id)
            .order('season', { ascending: false });
          
          const uniqueSeasons = [...new Set(seasonsData?.map(m => m.season))];
          setTemporadasDisponiveis(uniqueSeasons);
          
          if (uniqueSeasons.length > 0) {
            setTemporadaSelecionada(uniqueSeasons[0]);
            await getRankingLigaData(uniqueSeasons[0]);
          }
        }
        
        // Carrega o Ranking Global em background
        await getRankingGlobalData();

      } catch (err) {
        console.error("Erro no setup do ranking:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialSetup();
  }, [ligaId]);

  // 1. Carrega os dados da Liga de Amigos (Ordenado por Pontuação Customizada)
  async function getRankingLigaData(seasonStr) {
    const { data } = await supabase
      .from('ranking_detalhado')
      .select('*')
      .eq('user_league_id', ligaId)
      .order('total_points', { ascending: false })
      .order('cravadas', { ascending: false })
      .order('vencedor_bonus', { ascending: false })
      .order('vencedor_only', { ascending: false });

    if (data) setRankingLiga(data);
  }

  // 2. Lógica do RANKING GLOBAL (Corrigido para isolar métricas sem sobreposição automática)
  async function getRankingGlobalData() {
    try {
      const { data: allPredictions, error } = await supabase
        .from('predictions')
        .select(`
          user_id,
          prediction_home,
          prediction_away,
          users ( name ),
          matches!inner ( goals_home, goals_away, status )
        `)
        .eq('matches.status', 'finished');

      if (error) throw error;

      const userStats = {};

      allPredictions?.forEach(p => {
        const uId = p.user_id;
        if (!uId || !p.users) return;

        if (!userStats[uId]) {
          userStats[uId] = {
            user_id: uId,
            user_name: p.users.name,
            cravadas: 0,
            acertoGols: 0,
            acertoW: 0,
            total_jogos: 0
          };
        }

        const stat = userStats[uId];
        stat.total_jogos += 1;

        const realH = p.matches.goals_home;
        const realA = p.matches.goals_away;
        const palpH = p.prediction_home;
        const pAway = p.prediction_away;

        // --- CORREÇÃO DA LÓGICA DE SOMA DOS ACERTOS ---
        if (realH === palpH && realA === pAway) {
          // Placar EXATO: Conta estritamente como Cravada
          stat.cravadas += 1;
        } else {
          // Não cravou o placar. Vamos avaliar tendência e gols isolados de forma independente:
          const venceuHomeReal = realH > realA;
          const venceuAwayReal = realA > realH;
          const empateReal = realH === realA;

          const venceuHomePalp = palpH > pAway;
          const venceuAwayPalp = pAway > palpH;
          const empatePalp = palpH === pAway;

          // Acertou quem ganhou ou se deu empate
          if ((venceuHomeReal && venceuHomePalp) || (venceuAwayReal && venceuAwayPalp) || (empateReal && empatePalp)) {
            stat.acertoW += 1;
          }
          
          // Acertos isolados de gols por equipe
          if (realH === palpH) stat.acertoGols += 1;
          if (realA === pAway) stat.acertoGols += 1;
        }
      });

      // Ordenação de eficiência global estável
      const sortedGlobal = Object.values(userStats).sort((a, b) => 
        b.cravadas - a.cravadas || b.acertoW - a.acertoW || b.acertoGols - a.acertoGols
      );

      setRankingGlobal(sortedGlobal);
    } catch (err) {
      console.error("Erro ao computar ranking global:", err);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate(sportId ? `/leagues/${sportId}` : '/home')} 
          className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]"
        >
          ← VOLTAR
        </button>
        <div className="text-right">
          <Link to="/" className="block">
            <Logo size="sm" />
          </Link>
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">Líderes de Palpites</span>
        </div>
      </header>

      {/* SELETOR DE ABAS (TABS) */}
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2 mb-6 bg-[#1A1C3A] p-1.5 rounded-2xl border border-[#26283A]">
        <button 
          onClick={() => setActiveTab('liga')}
          className={`py-3 rounded-xl font-black text-xs uppercase tracking-tight transition-all ${activeTab === 'liga' ? 'bg-[#0077FF] text-white' : 'text-gray-400'}`}
        >
          🏆 Ranking da Liga
        </button>
        <button 
          onClick={() => setActiveTab('global')}
          className={`py-3 rounded-xl font-black text-xs uppercase tracking-tight transition-all ${activeTab === 'global' ? 'bg-[#0077FF] text-white' : 'text-gray-400'}`}
        >
          🌍 Geral do Aplicativo
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#0077FF] font-black animate-pulse text-xs uppercase tracking-widest">Sincronizando Quadros...</div>
      ) : (
        <div className="max-w-2xl mx-auto grid gap-4">
          
          {/* RENDER DA TAB: RANKING DA LIGA */}
          {activeTab === 'liga' && (
            <>
              <div className="mb-2">
                <select 
                  value={temporadaSelecionada}
                  onChange={(e) => { setTemporadaSelecionada(e.target.value); getRankingLigaData(e.target.value); }}
                  className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl font-black italic uppercase text-xs text-white focus:outline-none"
                >
                  {temporadasDisponiveis.map(temp => <option key={temp} value={temp}>TEMPORADA {temp}</option>)}
                </select>
              </div>

              {rankingLiga.map((user, index) => {
                const isCurrentUser = String(user.user_id) === String(currentUserId);
                return (
                  <RankingCard 
                    key={user.user_id} 
                    pos={index + 1} 
                    name={user.user_name} 
                    isUser={isCurrentUser} 
                    score={user.total_points} 
                    scoreLabel="PONTOS"
                    cravadas={user.cravadas} 
                    vencedores={user.vencedor_only} // Corrigido para não embutir a cravada na visualização da liga local
                    gols={user.vencedor_bonus} 
                    jogos={user.total_jogos} 
                  />
                );
              })}
            </>
          )}

          {/* RENDER DA TAB: RANKING GLOBAL */}
          {activeTab === 'global' && (
            <>
              <div className="bg-[#1A1C3A]/40 border border-dashed border-[#26283A] p-4 rounded-2xl text-center mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  💡 Este ranking ignora pontuações locais. O critério de desempate é: <br/>
                  <span className="text-[#0077FF] font-black">Cravadas</span> → <span className="text-green-400 font-black">Acertos de Vitória/Empate</span> → <span className="text-amber-400 font-black">Gols Individuais</span>.
                </p>
              </div>

              {rankingGlobal.length === 0 ? (
                <p className="text-center py-10 opacity-30 font-black uppercase italic">Sem palpites globais computados</p>
              ) : (
                rankingGlobal.map((user, index) => {
                  const isCurrentUser = String(user.user_id) === String(currentUserId);
                  return (
                    <RankingCard 
                      key={user.user_id} 
                      pos={index + 1} 
                      name={user.user_name} 
                      isUser={isCurrentUser} 
                      score={user.cravadas} 
                      scoreLabel="CRAVADAS"
                      cravadas={user.cravadas} 
                      vencedores={user.acertoW} 
                      gols={user.acertoGols} 
                      jogos={user.total_jogos} 
                    />
                  );
                })
              )}
            </>
          )}

        </div>
      )}
      <BottomNav />
    </div>
  );
}

function RankingCard({ pos, name, isUser, score, scoreLabel, cravadas, vencedores, gols, jogos }) {
  return (
    <div className={`relative overflow-hidden p-5 rounded-[30px] border transition-all duration-300 ${isUser ? 'bg-[#0077FF] border-white shadow-[0_0_25px_rgba(0,119,255,0.3)] scale-[1.02]' : 'bg-[#1A1C3A] border-[#26283A]'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <span className={`font-black italic text-xl ${isUser ? 'text-white' : 'text-[#0077FF]'} opacity-50`}>{pos}º</span>
          <div className="flex flex-col">
            <span className="font-black uppercase text-sm tracking-tighter italic leading-none text-white">{name}</span>
            {isUser && <span className="text-[7px] font-black uppercase text-white/70 tracking-widest mt-1">VOCÊ</span>}
          </div>
        </div>

        <div className="text-right">
          <span className="block font-black text-2xl italic leading-none text-white">{score}</span>
          <span className={`text-[8px] font-black uppercase tracking-wider ${isUser ? 'text-white/80' : 'text-[#0077FF]'}`}>{scoreLabel}</span>
        </div>
      </div>

      <div className={`grid grid-cols-4 gap-2 pt-3 border-t ${isUser ? 'border-white/20' : 'border-white/5'} text-center`}>
        <div>
          <span className="block font-black text-xs italic text-white">{cravadas}</span>
          <span className={`block text-[7px] font-black uppercase tracking-tight ${isUser ? 'text-white' : 'text-gray-500'}`}>Cravadas</span>
        </div>

        <div>
          <span className="block font-black text-xs italic text-white">{vencedores}</span>
          <span className={`block text-[7px] font-black uppercase tracking-tight ${isUser ? 'text-white' : 'text-gray-500'}`}>Vencedor</span>
        </div>

        <div>
          <span className="block font-black text-xs italic text-white">{gols}</span>
          <span className={`block text-[7px] font-black uppercase tracking-tight ${isUser ? 'text-white' : 'text-gray-500'}`}>Acerto Gols</span>
        </div>

        <div>
          <span className="block font-black text-xs italic text-white">{jogos}</span>
          <span className={`block text-[7px] font-black uppercase tracking-tight ${isUser ? 'text-white' : 'text-gray-500'}`}>Palpites</span>
        </div>
      </div>
    </div>
  );
}