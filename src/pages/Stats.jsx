import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  Target,
  Zap,
  TrendingDown,
  Activity,
  Crown,
  Flame,
  ArrowUpDown,
  History,
  Award,
  ListOrdered,
  X,
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'leaders' | 'gaps'
  const [historyOrder, setHistoryOrder] = useState('desc'); // 'desc' (mais recente no topo) | 'asc'
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(false);

  // Estado do Modal / Drawer de Rodadas
  const [modalDetails, setModalDetails] = useState(null);

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

  const {
    rankingWithGaps = [],
    roundHistory = [],
    leadershipBoard = [],
    roundKingsBoard = [],
    highlights = {},
  } = statsData || {};

  const sortedHistory = useMemo(() => {
    const list = [...roundHistory];
    return historyOrder === 'desc' ? list.reverse() : list;
  }, [roundHistory, historyOrder]);

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
        {t('predictions.messages.loadError', {
          defaultValue: 'Não foi possível carregar as estatísticas.',
        })}
      </div>
    );
  }

  const hasData = rankingWithGaps.length > 0 || roundHistory.length > 0;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      {/* HEADER PRINCIPAL */}
      <header className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-4 mb-6">
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

      {/* SUB-ABAS NAVEGÁVEIS (PILLS) */}
      <nav className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-[#1A1C3A] border border-[#26283A] rounded-2xl shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl font-black text-[11px] sm:text-xs uppercase italic tracking-tight transition-all text-center ${
              activeTab === 'history'
                ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History size={14} />
            <span>Histórico da Liga</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaders')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl font-black text-[11px] sm:text-xs uppercase italic tracking-tight transition-all text-center ${
              activeTab === 'leaders'
                ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Crown size={14} />
            <span>Quadro de Líderes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gaps')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl font-black text-[11px] sm:text-xs uppercase italic tracking-tight transition-all text-center ${
              activeTab === 'gaps'
                ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ListOrdered size={14} />
            <span>Gaps da Tabela</span>
          </button>
        </div>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-4xl mx-auto">
        {loadingStats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#1A1C3A] border border-[#26283A] h-28 rounded-[25px]" />
              ))}
            </div>
            <div className="bg-[#1A1C3A] border border-[#26283A] h-64 rounded-[30px] animate-pulse" />
          </div>
        ) : !hasData ? (
          <div className="bg-[#1A1C3A] border border-[#26283A] p-10 rounded-[35px] text-center shadow-xl">
            <Trophy className="w-12 h-12 text-[#0077FF] mx-auto mb-4 opacity-50" />
            <h2 className="text-base font-black italic uppercase text-white mb-2">
              Temporada sem jogos finalizados
            </h2>
            <p className="text-xs text-gray-400 font-bold max-w-md mx-auto">
              O histórico rodada a rodada, quadro de líderes e gaps serão calculados automaticamente
              assim que as partidas desta temporada forem concluídas.
            </p>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* ABA 1: HISTÓRICO DA LIGA (RÉPLICA DA PLANILHA)           */}
            {/* ======================================================== */}
            {activeTab === 'history' && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-black italic uppercase tracking-wider text-white flex items-center gap-2">
                      <History size={16} className="text-[#0077FF]" />
                      Evolução Histórica da Liga (Rodada a Rodada)
                    </h2>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight block mt-0.5">
                      Maior pontuador de cada jornada e líder acumulado após o término dos jogos
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryOrder((curr) => (curr === 'desc' ? 'asc' : 'desc'))}
                    className="self-start sm:self-auto bg-[#1A1C3A] border border-[#26283A] hover:border-[#0077FF] text-gray-300 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <ArrowUpDown size={12} />
                    <span>{historyOrder === 'desc' ? 'Mais recentes no topo' : 'Rodada 1 no topo'}</span>
                  </button>
                </div>

                {sortedHistory.length === 0 ? (
                  <div className="bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[25px] text-center text-xs text-gray-400 font-bold uppercase">
                    Nenhuma rodada foi finalizada nesta temporada ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedHistory.map((item) => (
                      <div
                        key={item.key}
                        className="bg-[#1A1C3A] border border-[#26283A] p-4 sm:p-5 rounded-[25px] hover:border-[#383A52] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
                      >
                        {/* Identificador da Rodada */}
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#0A0E2A] border border-[#26283A] flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-black uppercase text-gray-500 leading-none">
                              ROD
                            </span>
                            <span className="text-base font-black italic text-[#0077FF] leading-none mt-1">
                              {item.round}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-black italic uppercase text-white tracking-tight block">
                              {item.label}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                              Top da Rodada: {item.bestScore} PTS
                            </span>
                          </div>
                        </div>

                        {/* Bloco 1: Maior Pontuador da Rodada */}
                        <div className="flex-1 bg-[#0A0E2A]/70 border border-[#26283A] p-3 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1 mb-1">
                            <Flame size={12} className="text-amber-400" />
                            Maior Pontuador da Rodada
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-xs uppercase text-white truncate">
                              {item.bestPerformers.map((p) => p.name).join(', ')}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                {item.bestScore} PTS
                              </span>
                              {item.bestPerformers.length === 1 && (
                                <span className="bg-[#0077FF]/15 text-[#60A5FA] border border-[#0077FF]/30 font-black text-[8px] px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                  {item.bestPerformers[0].timesWon}ª vez
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bloco 2: Líder Acumulado ao Término da Rodada */}
                        <div className="flex-1 bg-[#0A0E2A]/70 border border-[#26283A] p-3 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1 mb-1">
                            <Crown size={12} className="text-yellow-400" />
                            Líder ao Fim da Rodada
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-xs uppercase text-white truncate">
                              {item.leader.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-black text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                Gap: {item.leader.gapText}
                              </span>
                              <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 font-black text-[8px] px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                {item.leader.roundsLeadingCount}ª na ponta
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* ABA 2: QUADRO DE LÍDERES & HALL DA FAMA                  */}
            {/* ======================================================== */}
            {activeTab === 'leaders' && (
              <div className="space-y-10">
                {/* DESTAQUES DA TEMPORADA (CARDS RÁPIDOS) */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy size={18} className="text-[#0077FF]" />
                    <h2 className="text-xs font-black italic uppercase tracking-wider text-gray-300">
                      Destaques da Temporada
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <HighlightCard
                      icon={Target}
                      accentColor="text-emerald-400"
                      borderColor="border-emerald-500/20"
                      title="Mais Certeiro"
                      name={highlights.topExactUser?.name || 'Aguardando'}
                      detail={
                        highlights.topExactUser
                          ? `${highlights.topExactUser.cravadas} cravadas (${highlights.topExactUser.percentage}%)`
                          : 'Sem cravadas registradas'
                      }
                    />

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

                {/* QUADRO 1: LÍDERES DE RODADAS NA PONTA */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xs sm:text-sm font-black italic uppercase tracking-wider text-white flex items-center gap-2">
                        <Crown size={16} className="text-yellow-400" />
                        Quem Mais Liderou o Campeonato (Finais de Rodada em 1º)
                      </h2>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight block mt-0.5">
                        Clique em qualquer participante para ver as rodadas em que ele liderou
                      </span>
                    </div>
                  </div>

                  {leadershipBoard.length === 0 ? (
                    <div className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[25px] text-center text-xs text-gray-400 font-bold uppercase">
                      Nenhuma rodada finalizada para apurar lideranças.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {leadershipBoard.map((item, idx) => (
                        <button
                          key={item.userId}
                          type="button"
                          onClick={() =>
                            setModalDetails({
                              title: 'Liderança do Campeonato',
                              name: item.name,
                              badge: `${item.roundsCount} ${item.roundsCount === 1 ? 'rodada' : 'rodadas'} em 1º lugar`,
                              description: `Esteve no topo da tabela em ${item.percentage}% das rodadas disputadas nesta temporada:`,
                              roundsList: item.roundsList,
                            })
                          }
                          className="bg-[#1A1C3A] border border-[#26283A] hover:border-yellow-500/50 p-4 rounded-[22px] flex items-center justify-between gap-3 text-left transition-all group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs italic flex-shrink-0 ${
                                idx === 0
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                  : 'bg-[#0A0E2A] text-gray-400 border border-[#26283A]'
                              }`}
                            >
                              {idx + 1}º
                            </div>
                            <div className="min-w-0">
                              <span className="font-black text-xs uppercase text-white truncate block group-hover:text-yellow-400 transition-colors">
                                {item.name}
                              </span>
                              <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                {item.percentage}% das rodadas
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                              {item.roundsCount} {item.roundsCount === 1 ? 'rodada' : 'rodadas'}
                            </span>
                            <span className="text-xs text-gray-500 group-hover:text-yellow-400 transition-colors">
                              ›
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* QUADRO 2: REIS DA RODADA (MAIOR PONTUADOR POR MAIS RODADAS) */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xs sm:text-sm font-black italic uppercase tracking-wider text-white flex items-center gap-2">
                        <Award size={16} className="text-[#0077FF]" />
                        Reis da Rodada (Mais Vezes Maior Pontuador)
                      </h2>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight block mt-0.5">
                        Clique em qualquer participante para ver as rodadas em que foi o melhor
                      </span>
                    </div>
                  </div>

                  {roundKingsBoard.length === 0 ? (
                    <div className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[25px] text-center text-xs text-gray-400 font-bold uppercase">
                      Nenhuma rodada finalizada para apurar os maiores pontuadores.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {roundKingsBoard.map((item, idx) => (
                        <button
                          key={item.userId}
                          type="button"
                          onClick={() =>
                            setModalDetails({
                              title: 'Campeão da Rodada',
                              name: item.name,
                              badge: `${item.winsCount}x Maior Pontuador`,
                              description: `Foi o melhor pontuador nas seguintes rodadas da temporada:`,
                              roundsList: item.roundsList,
                            })
                          }
                          className="bg-[#1A1C3A] border border-[#26283A] hover:border-[#0077FF] p-4 rounded-[22px] flex items-center justify-between gap-3 text-left transition-all group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs italic flex-shrink-0 ${
                                idx === 0
                                  ? 'bg-[#0077FF]/20 text-[#60A5FA] border border-[#0077FF]/40'
                                  : 'bg-[#0A0E2A] text-gray-400 border border-[#26283A]'
                              }`}
                            >
                              {idx + 1}º
                            </div>
                            <div className="min-w-0">
                              <span className="font-black text-xs uppercase text-white truncate block group-hover:text-[#60A5FA] transition-colors">
                                {item.name}
                              </span>
                              <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                Maior pontuador
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="bg-[#0077FF]/15 text-[#60A5FA] border border-[#0077FF]/30 text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                              {item.winsCount}x melhor
                            </span>
                            <span className="text-xs text-gray-500 group-hover:text-[#60A5FA] transition-colors">
                              ›
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 3: GAPS DA TABELA ATUAL (RANKING OFICIAL)            */}
            {/* ======================================================== */}
            {activeTab === 'gaps' && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-black italic uppercase tracking-wider text-white flex items-center gap-2">
                      <ListOrdered size={16} className="text-[#0077FF]" />
                      Classificação Oficial e Gaps da Tabela
                    </h2>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight block mt-0.5">
                      Distância para o líder e para o colocado imediatamente à frente (idêntico ao Ranking)
                    </span>
                  </div>
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
                              🎯 {user.cravadas} cravadas ({user.exactPercentage}%) • {user.totalJogos} palpites
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
            )}
          </>
        )}
      </main>

      {/* MODAL / DRAWER INTERATIVO DE RODADAS */}
      {modalDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] rounded-[30px] p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0077FF] block">
                  {modalDetails.title}
                </span>
                <h3 className="text-lg font-black uppercase italic text-white flex items-center gap-2 mt-0.5">
                  {modalDetails.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalDetails(null)}
                className="w-8 h-8 rounded-full bg-[#0A0E2A] text-gray-400 hover:text-white flex items-center justify-center border border-[#26283A] transition-colors"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4">
              <span className="inline-block bg-[#0077FF]/15 text-[#60A5FA] border border-[#0077FF]/30 text-[11px] font-black px-3 py-1 rounded-xl uppercase tracking-wider mb-2">
                {modalDetails.badge}
              </span>
              <p className="text-xs text-gray-400 font-bold">
                {modalDetails.description}
              </p>
            </div>

            <div className="bg-[#0A0E2A] border border-[#26283A] p-4 rounded-2xl max-h-60 overflow-y-auto custom-scrollbar">
              <div className="flex flex-wrap gap-2">
                {modalDetails.roundsList && modalDetails.roundsList.length > 0 ? (
                  modalDetails.roundsList.map((roundStr, i) => (
                    <span
                      key={i}
                      className="bg-[#1A1C3A] border border-[#26283A] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                    >
                      {roundStr}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 font-bold">Nenhuma rodada listada</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalDetails(null)}
              className="mt-5 w-full bg-[#0077FF] hover:bg-[#0066DD] text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

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
        <span
          className={`text-sm sm:text-base font-black uppercase italic tracking-tight truncate block ${accentColor}`}
        >
          {name}
        </span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mt-0.5">
          {detail}
        </span>
      </div>
    </div>
  );
}
