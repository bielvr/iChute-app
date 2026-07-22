import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as htmlToImage from 'html-to-image';
import BottomNav from '../components/layout/BottomNav';
import Logo from '../components/Logo';
import CalendarPicker from '../components/layout/CalendarPicker';
import { getLeagueComparisonContext } from '../services/leagueService';
import { getFirstMatchByRound, getLatestSeason, getMatchCountsByDay, getMatches, getNearestMatch, getRounds } from '../services/matchService';
import { getLeaguePredictions } from '../services/predictionService';
import { buildGamesCountMap, toInputDate } from '../utils/date';

const CUP_ROUND_KEYS = { 4: 'rounds.roundOf32', 5: 'rounds.roundOf16', 6: 'rounds.quarterFinal', 7: 'rounds.semiFinal', 8: 'rounds.thirdPlace', 9: 'rounds.final' };
const hasMatchStarted = (date) => new Date() >= new Date(date);

export default function Comparison() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const cardRefs = useRef({});
  const [context, setContext] = useState(null);
  const [season, setSeason] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [gamesPerDay, setGamesPerDay] = useState({});
  const [matches, setMatches] = useState([]);
  const [predictionsByMatch, setPredictionsByMatch] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState(false);

  const isFootball = context?.sportId === 1;

  const loadPredictions = useCallback(async (matchList, userLeagueId) => {
    if (matchList.length === 0) { setPredictionsByMatch({}); return; }
    const predictions = await getLeaguePredictions(userLeagueId, matchList.map((match) => match.id));
    const matrix = predictions.reduce((result, prediction) => {
      const matchId = prediction.matches?.id;
      const userId = prediction.users?.id;
      if (!matchId || !userId) return result;
      result[matchId] ??= {};
      result[matchId][userId] = { home: prediction.prediction_home, away: prediction.prediction_away, points: prediction.points_earned ?? 0 };
      return result;
    }, {});
    setPredictionsByMatch(matrix);
  }, []);

  const loadMatches = useCallback(async ({ date, currentContext, currentSeason }) => {
    const matchList = await getMatches({ leagueId: currentContext.officialLeagueId, season: currentSeason, date });
    setMatches(matchList);
    await loadPredictions(matchList, currentContext.id);
  }, [loadPredictions]);

  const loadGameCounts = useCallback(async ({ currentContext, currentSeason, round }) => {
    const countMatches = await getMatchCountsByDay({ leagueId: currentContext.officialLeagueId, season: currentSeason, round });
    setGamesPerDay(buildGamesCountMap(countMatches));
  }, []);

  useEffect(() => {
    if (!ligaId || ligaId === 'undefined') return;
    const initialize = async () => {
      setLoading(true); setError(false);
      try {
        const leagueContext = await getLeagueComparisonContext(ligaId);
        const currentSeason = await getLatestSeason(leagueContext.officialLeagueId);
        const football = leagueContext.sportId === 1;
        const [availableRounds, lastMatch, nextMatch] = await Promise.all([
          football ? getRounds(leagueContext.officialLeagueId, currentSeason) : Promise.resolve([]),
          getNearestMatch({ leagueId: leagueContext.officialLeagueId, season: currentSeason, direction: 'previous' }),
          getNearestMatch({ leagueId: leagueContext.officialLeagueId, season: currentSeason, direction: 'next' }),
        ]);
        const referenceMatch = lastMatch ?? nextMatch;
        const initialDate = referenceMatch ? toInputDate(referenceMatch.date) : toInputDate(new Date());
        const initialRound = football ? (referenceMatch?.round ?? availableRounds[0] ?? '') : null;
        setContext(leagueContext); setSeason(currentSeason); setRounds(availableRounds); setSelectedRound(initialRound); setSelectedDate(initialDate);
        await Promise.all([
          loadGameCounts({ currentContext: leagueContext, currentSeason, round: initialRound }),
          loadMatches({ date: initialDate, currentContext: leagueContext, currentSeason }),
        ]);
      } catch (loadError) { console.error('Unable to load comparison', loadError); setError(true); }
      finally { setLoading(false); }
    };
    initialize();
  }, [ligaId, loadGameCounts, loadMatches]);

  const handleDateChange = async (date) => { if (!context || !season) return; setSelectedDate(date); setLoadingMatches(true); try { await loadMatches({ date, currentContext: context, currentSeason: season }); } finally { setLoadingMatches(false); } };
  const handleRoundChange = async (round) => { if (!context || !season) return; setLoadingMatches(true); try { const match = await getFirstMatchByRound(context.officialLeagueId, season, round); const date = match ? toInputDate(match.date) : selectedDate; setSelectedRound(round); setSelectedDate(date); await Promise.all([loadGameCounts({ currentContext: context, currentSeason: season, round }), loadMatches({ date, currentContext: context, currentSeason: season })]); } finally { setLoadingMatches(false); } };

  const handleShareCard = async (match) => {
    const card = cardRefs.current[match.id];
    if (!card) return;
    const shareButton = card.querySelector('[data-share-button]');
    try {
      if (shareButton) shareButton.style.visibility = 'hidden';
      const imageUrl = await htmlToImage.toPng(card, { quality: 0.95, backgroundColor: '#1A1C3A', style: { borderRadius: '30px' }, cacheBust: true });
      const imageBlob = await (await fetch(imageUrl)).blob();
      const file = new File([imageBlob], `iChute-${match.home_team?.name ?? 'match'}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('comparison.share.title'), text: t('comparison.share.text') });
      else { const link = document.createElement('a'); link.href = imageUrl; link.download = file.name; link.click(); window.alert(t('comparison.share.downloaded')); }
    } catch (shareError) { if (shareError.name !== 'AbortError') { console.error('Unable to share card', shareError); window.alert(t('comparison.share.error')); } }
    finally { if (shareButton) shareButton.style.visibility = 'visible'; }
  };

  const formatRound = (round) => { const key = context?.officialLeagueId === 12 ? CUP_ROUND_KEYS[round] : null; return key ? t(`predictions.${key}`) : t('predictions.round', { round }); };
  if (loading) return <Loading label={t('comparison.loading')} />;
  if (error || !context) return <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center">{t('comparison.messages.loadError')}</div>;

  return <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans subpixel-antialiased"><header className="max-w-2xl mx-auto flex flex-col gap-3 mb-6"><div className="flex justify-between items-center mb-2"><button onClick={() => navigate(context.sportId ? `/leagues/${context.sportId}` : '/home')} className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]">← {t('common.back')}</button><div className="text-right"><Link to="/" className="block"><Logo size="sm" /></Link><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">{t('comparison.title')}</span></div></div>{isFootball && <div className="relative w-full"><select value={selectedRound} onChange={(event) => handleRoundChange(event.target.value)} className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 pr-10 rounded-2xl font-black italic uppercase text-[#0077FF] focus:outline-none appearance-none cursor-pointer text-sm tracking-wide">{rounds.map((round) => <option key={round} value={round}>{formatRound(round)}</option>)}</select><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#0077FF] pointer-events-none">▼</span></div>}<CalendarPicker selectedDate={selectedDate} gamesPerDay={gamesPerDay} onSelectDate={handleDateChange} /></header><div className="max-w-2xl mx-auto grid gap-6 relative">{loadingMatches && <div className="absolute inset-0 bg-[#0A0E2A]/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-3xl min-h-[200px]"><div className="text-[#0077FF] text-[10px] font-black tracking-wider animate-pulse">{t('comparison.updating')}</div></div>}{!loadingMatches && matches.length === 0 && <div className="text-center py-20 text-white/10 font-black italic uppercase tracking-widest">{t('comparison.empty')}</div>}{matches.map((match) => <ComparisonCard key={match.id} match={match} users={context.members} predictions={predictionsByMatch[match.id]} points={context.points} cardRef={(element) => { cardRefs.current[match.id] = element; }} onShare={handleShareCard} t={t} />)}</div><BottomNav /></div>;
}

function Loading({ label }) { return <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center"><div className="text-[#0077FF] font-black italic animate-pulse tracking-widest">{label}</div></div>; }
function ComparisonCard({ match, users, predictions, points, cardRef, onShare, t }) {
  return (
    <div
      ref={cardRef}
      className="bg-[#1A1C3A] border border-[#26283A] rounded-[30px] p-4 sm:p-6 shadow-2xl relative w-full overflow-hidden"
    >
      {/* Botão de Compartilhar / Ações no topo (se houver) */}
      {onShare && (
        <button
          onClick={() => onShare(match.id)}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#0077FF] text-xs p-2 rounded-xl transition-colors z-10"
          aria-label={t('common.share')}
        >
          📤
        </button>
      )}

      {/* CABEÇALHO DA PARTIDA (Nivelado e Centralizado) */}
      <div className="bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 flex items-center justify-between mb-4 w-full">
        {/* Time da Casa: Nome à direita, Escudo encostado no centro */}
        <div className="flex-1 flex items-center justify-end gap-2.5 sm:gap-3 text-right min-w-0">
          <span className="font-black uppercase text-xs sm:text-sm truncate text-white tracking-tight">
            {match.home_team?.name}
          </span>
          <img
            src={match.home_team?.url_logo}
            alt={match.home_team?.name ?? ''}
            className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0"
          />
        </div>

        {/* Placar Centralizado */}
        <div className="px-3 sm:px-5 text-center flex-shrink-0">
          <span className="font-black italic text-sm sm:text-base tracking-widest text-white">
            {match.home_score !== null && match.away_score !== null ? (
              <>
                {match.home_score} <span className="text-[#0077FF] mx-0.5">x</span> {match.away_score}
              </>
            ) : (
              <span className="text-gray-400">
                - <span className="text-[#0077FF] mx-0.5">x</span> -
              </span>
            )}
          </span>
        </div>

        {/* Time Visitante: Escudo encostado no centro, Nome à esquerda */}
        <div className="flex-1 flex items-center justify-start gap-2.5 sm:gap-3 text-left min-w-0">
          <img
            src={match.away_team?.url_logo}
            alt={match.away_team?.name ?? ''}
            className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0"
          />
          <span className="font-black uppercase text-xs sm:text-sm truncate text-white tracking-tight">
            {match.away_team?.name}
          </span>
        </div>
      </div>

      {/* LISTA DE PALPITES DOS USUÁRIOS */}
      <div className="flex flex-col gap-2.5">
        {users?.map((user) => {
          const pred = predictions?.[user.id];
          const pts = points?.[match.id]?.[user.id];

          // Destaque verde para acertos
          const isWinner = pts && pts > 0;

          return (
            <div
              key={user.id}
              className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm transition-all ${
                isWinner
                  ? 'bg-[#00FF66]/10 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.15)]'
                  : 'bg-[#13152E] border-[#26283A]'
              }`}
            >
              {/* Nome do Jogador */}
              <span className="font-black uppercase tracking-tight text-white/90 italic truncate max-w-[30%]">
                {user.name || user.username}
              </span>

              {/* Palpite do Jogador */}
              <div className="font-black italic text-center tracking-wider text-white">
                {pred && (pred.home !== '' || pred.away !== '') ? (
                  <>
                    {pred.home} <span className="text-[#0077FF] mx-0.5">x</span> {pred.away}
                  </>
                ) : (
                  <span className="text-gray-600 font-normal">-- x --</span>
                )}
              </div>

              {/* Pontuação Obtida */}
              <div
                className={`px-3 py-1 rounded-xl text-[10px] sm:text-xs font-black uppercase italic tracking-wider ${
                  isWinner
                    ? 'bg-[#00FF66] text-black shadow-md'
                    : 'bg-[#0A0E2A] text-gray-600 border border-[#26283A]'
                }`}
              >
                {pts ?? 0} PTS
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function MatchTeam({ team, align }) { return <div className={`flex items-center gap-3 w-5/12 ${align ? 'justify-end' : 'justify-start'}`}><span className={`text-[11px] font-black uppercase text-white/80 tracking-wide truncate max-w-[90px] ${align ? 'text-right order-first' : 'text-left'}`}>{team?.name}</span><img src={team?.url_logo} className="w-7 h-7 object-contain" alt="" /></div>; }
function PredictionRow({ user, prediction, started, points, t }) { const score = prediction?.points ?? 0; const theme = getPointTheme(score, points); const value = prediction ? (started ? `${prediction.home} x ${prediction.away}` : '?? x ??') : '-- x --'; return <div className={`flex justify-between items-center p-3 rounded-xl border ${theme.border} bg-[#0A0E2A]/40`}><span className="text-[10px] font-black uppercase italic text-white/50 w-1/4">{user.name.split(' ')[0]}</span><div className="w-2/4 flex justify-center"><span className={`font-black italic text-xs tracking-wider ${prediction ? 'text-white' : 'text-white/20'}`}>{value}</span></div><div className="w-1/4 flex justify-end"><div className={`min-w-[60px] text-center py-1 px-2 rounded-lg text-[8px] font-black italic tracking-wide ${theme.bg} ${theme.text}`}>{t('comparison.points', { count: score })}</div></div></div>; }
function getPointTheme(score, points) { if (score > 0 && score === points.exact) return { bg: 'bg-[#39FF14]', text: 'text-[#2B302A]', border: 'border-[#39FF14]' }; if (score > 0 && score === points.winnerAndOneGoal) return { bg: 'bg-[#FAFF00]/40', text: 'text-white', border: 'border-[#FAFF00]/50' }; if (score > 0 && score === points.winnerOnly) return { bg: 'bg-[#0077FF]/40', text: 'text-white', border: 'border-[#0077FF]/50' }; return { bg: 'bg-[#0A0E2A]/60', text: 'text-white/20', border: 'border-white/5' }; }
