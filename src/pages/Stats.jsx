import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trophy, Target, Zap, TrendingDown, Activity } from 'lucide-react';
import BottomNav from '../components/layout/BottomNav';
import Logo from '../components/Logo';
import { getCurrentUser } from '../services/authService';
import { getUserLeagueDetails } from '../services/leagueService';
import { getAvailableSeasons, getLeagueStats } from '../services/statsService';

function formatSeasonDisplay(season) {
  if (!season) return '';
  const str = String(season);
  if (str.length === 8 && /^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}/${str.slice(4)}`;
  }
  return str;
}

export default function Stats() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [league, setLeague] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [statsData, setStatsData] = useState(null);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(false);

  // 1. Inicializa usuário, liga e lista de temporadas
  useEffect(() => {
    if (!ligaId) return;
    let isMounted = true;

    const initialize = async () => {
      setLoadingSeasons(true);
      setError(false);
      try {
        const [user, userLeague] = await Promise.all([
          getCurrentUser(),
          getUserLeagueDetails(ligaId),
        ]);
        if (!user) {
          navigate('/');
          return;
        }
        if (!isMounted) return;

        setLeague(userLeague);
        setCurrentUserId(user.id);

        const available = await getAvailableSeasons(userLeague.officialLeagueId);
        if (!isMounted) return;

        setSeasons(available);
        if (available.length > 0) {
          setSelectedSeason(available[0]);
        }
      } catch (loadError) {
        console.error('Unable to initialize stats', loadError);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoadingSeasons(false);
      }
    };

    initialize();
    return () => {
      isMounted = false;
    };
  }, [ligaId, navigate]);

  // 2. Carrega estatísticas quando liga ou temporada selecionada mudarem
  useEffect(() => {
    if (!league || !selectedSeason) return;
    let isMounted = true;

    const loadStats = async () => {
      setLoadingStats(true);
      setError(false);
      try {
        const data = await getLeagueStats({
          userLeagueId: league.id,
          officialLeagueId: league.officialLeagueId,
          season: selectedSeason,
        });

        if (!isMounted) return;
        setStatsData(data);
      } catch (statsError) {
        console.error('Unable to load league stats', statsError);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [league, selectedSeason]);

  if (loadingSeasons) {
    return (
      <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse tracking-widest uppercase">
        {t('predictions.loading', { defaultValue: 'Sincronizando estatísticas...' })}
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center font-bold">
        {t('predictions.messages.loadError', { defaultValue: 'Não foi possível carregar as estatísticas.' })}
      </div>
    );
  }

  const { rankingWithGaps = [], bestByRound = [], highlights = {} } = statsData || {};
  const hasFinishedMatches = statsData && statsData.totalMatches > 0;
  const hasRankingData = rankingWithGaps.some((u) => u.totalPoints > 0 || u.totalPredictions > 0);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      {/* HEADER */}
      <header className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-4 mb-8">
        <button
          onClick={() => navigate(league.sportId ? `/leagues/${league.sportId}` : '/home')}
          className="bg-[#1A1C3A] text-white px-5 py-2.5 rounded-2xl text-[10px] font-black border border-[#26283A] hover:border-[#0077FF] transition-all"
        >
          ← {t('common.back', { defaultValue: 'Voltar' })}
        </button>

        <div className="flex items-center gap-3">
          {seasons.length > 0 && (
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-[#1A1C3A] border border-[#26283A] text-white font-bold rounded-xl px-4 py-2 text-xs outline-none focus:border-[#0077FF] cursor-pointer"
              aria-label="Temporada"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {formatSeasonDisplay(s)}
                </option>
              ))}
            </select>
          )}

          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Logo size="sm" />
              <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter leading-none">
                ESTATÍSTICAS
              </h1>
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mt-1">
              {league.name}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-10">
        {loadingStats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#1A1C3A] border border-[#26283A] h-28 rounded-[25px]" />
              ))}
            </div>
            <div className="bg-[#1A1C3A] border border-[#26283A] h-64 rounded-[30px] animate-pulse" />
          </div>
        ) : !hasFinishedMatches && !hasRankingData ? (
          <div className="bg-[#1A1C3A] border border-[#26283A] p-10 rounded-[35px] text-center shadow-xl">
            <Trophy className="w-12 h-12 text-[#0077FF] mx-auto mb-4 opacity-50" />
            <h2 className="text-base font-black italic uppercase text-white mb-2">
              Temporada sem jogos finalizados
            </h2>
            <p className="text-xs text-gray-400 font-bold max-w-md mx-auto">
              As estatísticas, gaps da tabela e destaques por rodada serão computados automaticamente assim
              que as primeiras partidas desta temporada forem concluídas.
            </p>
          </div>
        ) : (
          <>
            {/* SEÇÃO 1: CARDS DE DESTAQUE (HALL DA FAMA) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={18} className="text-[#0077FF]" />
                <h2 className="text-xs font-black italic uppercase tracking-wider text-gray-300">
                  Hall da Fama da Temporada
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Mais Certeiro */}
                <HighlightCard
                  icon={Target}
                  accentColor="text-emerald-400"
                  borderColor="border-emerald-500/20"
                  title="Mais Certeiro"
                  name={highlights.topExactUser?.name || 'Aguardando'}
                  detail={
                    highlights.topExactUser
                      ? `${highlights.topExactUser.exactCount} cravadas (${highlights.topExactUser.percentage}%)`
                      : 'Sem cravadas registradas'
                  }
                />

                {/* 2. Recorde de Rodada */}
                <HighlightCard
                  icon={Zap}
                  accentColor="text-yellow-400"
                  borderColor="border-yellow-500/20"
                  title="Recorde em Rodada"
                  name={highlights.recordRoundUser?.name || 'Aguardando'}
                  detail={
                    highlights.recordRoundUser
                      ? `${highlights.recordRoundUser.points} pts (${highlights.recordRoundUser.roundLabel})`
                      : 'Nenhum ponto registrado'
                  }
                />

                {/* 3. Secador da Rodada */}
                <HighlightCard
                  icon={TrendingDown}
                  accentColor="text-red-400"
                  borderColor="border-red-500/20"
                  title="Secador da Rodada"
                  name={highlights.worstRoundUser?.name || 'Aguardando'}
                  detail={
                    highlights.worstRoundUser
                      ? `${highlights.worstRoundUser.points} pts (${highlights.worstRoundUser.roundLabel})`
                      : 'Nenhum dado computado'
                  }
                />

                {/* 4. Eficiência da Liga */}
                <HighlightCard
                  icon={Activity}
                  accentColor="text-[#0077FF]"
                  borderColor="border-[#0077FF]/20"
                  title="Eficiência da Liga"
                  name={`${highlights.leagueEfficiency?.averagePointsPerPred || '0.0'} pts/jogo`}
                  detail={`${highlights.leagueEfficiency?.totalExacts || 0} cravadas • ${
                    highlights.leagueEfficiency?.finishedMatches || 0
                  } jogos`}
                />
              </div>
            </section>

            {/* SEÇÃO 2: DIFERENÇA NA TABELA (GAPS) */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0077FF]" />
                  <h2 className="text-xs font-black italic uppercase tracking-wider text-gray-300">
                    Diferença na Tabela (Gaps)
                  </h2>
                </div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                  Distância para o líder e para o colocado imediatamente à frente
                </span>
              </div>

              <div className="space-y-3">
                {rankingWithGaps.map((user) => {
                  const isCurrentUser = Number(user.id) === Number(currentUserId);

                  return (
                    <div
                      key={user.id}
                      className={`relative bg-[#1A1C3A] border p-4 sm:p-5 rounded-[25px] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        user.isLeader
                          ? 'border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                          : isCurrentUser
                          ? 'border-[#0077FF] shadow-[0_0_20px_rgba(0,119,255,0.15)]'
                          : 'border-[#26283A] hover:border-[#383A52]'
                      }`}
                    >
                      {/* Posição e Nome */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm italic flex-shrink-0 ${
                            user.isLeader
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                              : user.position === 2
                              ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30'
                              : user.position === 3
                              ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30'
                              : 'bg-[#0A0E2A] text-gray-500 border border-[#26283A]'
                          }`}
                        >
                          {user.position}º
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm sm:text-base uppercase tracking-tight text-white truncate">
                              {user.name}
                            </span>
                            {isCurrentUser && (
                              <span className="bg-[#0077FF] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                                Você
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                            🎯 {user.exactCount} cravadas ({user.exactPercentage}%)
                          </span>
                        </div>
                      </div>

                      {/* Pontuação e Badges de Gaps */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#26283A]">
                        {/* Badges de Distância */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {user.isLeader ? (
                            <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                              👑 Líder da Liga
                            </span>
                          ) : (
                            <>
                              <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                                -{user.diffToLeader} {user.diffToLeader === 1 ? 'pt' : 'pts'} do líder
                              </span>
                              <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#0077FF]/15 text-[#60A5FA] border border-[#0077FF]/30">
                                -{user.diffToAhead} {user.diffToAhead === 1 ? 'pt' : 'pts'} do{' '}
                                {user.aheadPosition}º
                              </span>
                            </>
                          )}
                        </div>

                        {/* Pontos Totais */}
                        <div className="text-right pl-3 sm:border-l sm:border-[#26283A] min-w-[75px]">
                          <span className="text-lg sm:text-xl font-black italic tracking-tighter text-[#0077FF] block leading-none">
                            {user.totalPoints}
                          </span>
                          <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider">
                            PONTOS
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SEÇÃO 3: MELHORES POR RODADA */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h2 className="text-xs font-black italic uppercase tracking-wider text-gray-300">
                    Melhores por Rodada
                  </h2>
                </div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                  Vencedores e pontuação máxima em cada rodada
                </span>
              </div>

              {bestByRound.length === 0 ? (
                <div className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[25px] text-center text-xs text-gray-500 font-bold uppercase">
                  Nenhuma rodada finalizada até o momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bestByRound.map((roundItem) => {
                    const winnerNames = roundItem.winners.map((w) => w.name).join(', ');
                    const isMultiple = roundItem.winners.length > 1;

                    return (
                      <div
                        key={roundItem.key}
                        className="bg-[#1A1C3A] border border-[#26283A] p-4 rounded-[22px] flex flex-col justify-between hover:border-[#383A52] transition-colors gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 bg-[#0A0E2A] px-2.5 py-1 rounded-lg border border-[#26283A]">
                            {roundItem.label}
                          </span>
                          <span className="text-xs font-black italic text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                            {roundItem.points} PTS
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm">👑</span>
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase text-gray-500 block tracking-wider">
                              {isMultiple ? 'Empate na liderança' : 'Campeão da rodada'}
                            </span>
                            <span className="text-xs font-black uppercase text-white truncate block">
                              {winnerNames}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function HighlightCard({ icon, accentColor, borderColor, title, name, detail }) {
  const Icon = icon;
  return (
    <div
      className={`bg-[#1A1C3A] border ${borderColor} p-4 sm:p-5 rounded-[25px] flex flex-col justify-between shadow-lg relative overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">
          {title}
        </span>
        <div className={`p-2 rounded-xl bg-[#0A0E2A] ${accentColor}`}>
          <Icon size={16} />
        </div>
      </div>

      <div>
        <span className={`text-sm sm:text-base font-black uppercase italic tracking-tight truncate block ${accentColor}`}>
          {name}
        </span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mt-0.5">
          {detail}
        </span>
      </div>
    </div>
  );
}
