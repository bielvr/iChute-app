import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/layout/BottomNav';
import Logo from '../components/Logo';
import CalendarPicker from '../components/layout/CalendarPicker';
import { getCurrentUser } from '../services/authService';
import { getUserLeagueDetails } from '../services/leagueService';
import {
  getFirstMatchByRound,
  getLatestSeason,
  getMatchCountsByDay,
  getMatches,
  getNearestMatch,
  getRounds,
} from '../services/matchService';
import { getPredictions, savePredictions } from '../services/predictionService';
import { buildGamesCountMap, formatTime, toInputDate } from '../utils/date';

const CUP_ROUND_KEYS = {
  4: 'rounds.roundOf32',
  5: 'rounds.roundOf16',
  6: 'rounds.quarterFinal',
  7: 'rounds.semiFinal',
  8: 'rounds.thirdPlace',
  9: 'rounds.final',
};

const isPredictionValid = (prediction) =>
  prediction && (prediction.home !== '' || prediction.away !== '');

const hasMatchStarted = (matchDate) => new Date() >= new Date(matchDate);

export default function Predictions() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [league, setLeague] = useState(null);
  const [season, setSeason] = useState(null);
  const [userId, setUserId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [gamesPerDay, setGamesPerDay] = useState({});
  const [saveStatus, setSaveStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const isFootball = league?.sportId === 1;

  const loadMatches = useCallback(async ({ date, currentLeague, currentSeason, currentUserId }) => {
    const matchList = await getMatches({
      leagueId: currentLeague.officialLeagueId,
      season: currentSeason,
      date,
    });

    setMatches(matchList);

    if (!currentUserId || matchList.length === 0) {
      setPredictions({});
      return;
    }

    const savedPredictions = await getPredictions(
      currentUserId,
      currentLeague.id,
      matchList.map((match) => match.id),
    );

    setPredictions(Object.fromEntries(savedPredictions.map((prediction) => [
      prediction.match_id,
      { home: prediction.prediction_home, away: prediction.prediction_away },
    ])));
  }, []);

  const loadGameCounts = useCallback(async ({ currentLeague, currentSeason, round }) => {
    const countMatches = await getMatchCountsByDay({
      leagueId: currentLeague.officialLeagueId,
      season: currentSeason,
      round,
    });
    setGamesPerDay(buildGamesCountMap(countMatches));
  }, []);

  useEffect(() => {
    if (!ligaId || ligaId === 'undefined') return;

    const initialize = async () => {
      setLoading(true);
      setError(false);

      try {
        const [currentUser, userLeague] = await Promise.all([
          getCurrentUser(),
          getUserLeagueDetails(ligaId),
        ]);
        const currentSeason = await getLatestSeason(userLeague.officialLeagueId);
        const football = userLeague.sportId === 1;
        const [availableRounds, nextMatch, lastMatch] = await Promise.all([
          football ? getRounds(userLeague.officialLeagueId, currentSeason) : Promise.resolve([]),
          getNearestMatch({ leagueId: userLeague.officialLeagueId, season: currentSeason, direction: 'next' }),
          getNearestMatch({ leagueId: userLeague.officialLeagueId, season: currentSeason, direction: 'previous' }),
        ]);
        const referenceMatch = nextMatch ?? lastMatch;
        const initialDate = referenceMatch ? toInputDate(referenceMatch.date) : toInputDate(new Date());
        const initialRound = football ? (referenceMatch?.round ?? availableRounds[0] ?? '') : null;

        setLeague(userLeague);
        setUserId(currentUser?.id ?? null);
        setSeason(currentSeason);
        setRounds(availableRounds);
        setSelectedRound(initialRound);
        setSelectedDate(initialDate);

        await Promise.all([
          loadGameCounts({ currentLeague: userLeague, currentSeason, round: initialRound }),
          loadMatches({ date: initialDate, currentLeague: userLeague, currentSeason, currentUserId: currentUser?.id }),
        ]);
      } catch (loadError) {
        console.error('Unable to load predictions', loadError);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [ligaId, loadGameCounts, loadMatches]);

  const handleDateChange = async (date) => {
    if (!league || !season) return;
    setSelectedDate(date);
    setLoading(true);
    try {
      await loadMatches({ date, currentLeague: league, currentSeason: season, currentUserId: userId });
    } finally {
      setLoading(false);
    }
  };

  const handleRoundChange = async (round) => {
    if (!league || !season) return;
    setLoading(true);
    try {
      const firstMatch = await getFirstMatchByRound(league.officialLeagueId, season, round);
      const date = firstMatch ? toInputDate(firstMatch.date) : selectedDate;
      setSelectedRound(round);
      setSelectedDate(date);
      await Promise.all([
        loadGameCounts({ currentLeague: league, currentSeason: season, round }),
        loadMatches({ date, currentLeague: league, currentSeason: season, currentUserId: userId }),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePredictionChange = (matchId, side, value) => {
    const score = value === '' ? '' : Math.max(0, Number.parseInt(value, 10) || 0);
    setPredictions((current) => ({
      ...current,
      [matchId]: { ...current[matchId], [side]: score },
    }));
  };

  const persistPredictions = async (matchIds) => {
    if (!userId || !league) return false;
    const payload = matchIds
      .map((matchId) => {
        const match = matches.find((item) => item.id === Number(matchId));
        const prediction = predictions[matchId];
        if (!match || hasMatchStarted(match.date) || !isPredictionValid(prediction)) return null;
        return {
          userId,
          userLeagueId: league.id,
          matchId: Number(matchId),
          predictionHome: prediction.home === '' ? 0 : prediction.home,
          predictionAway: prediction.away === '' ? 0 : prediction.away,
        };
      })
      .filter(Boolean);

    if (payload.length === 0) return false;
    await savePredictions(payload);
    return true;
  };

  const handleSingleSave = async (matchId) => {
    const match = matches.find((item) => item.id === Number(matchId));
    if (match && hasMatchStarted(match.date)) {
      setSaveStatus((current) => ({ ...current, [matchId]: 'blocked' }));
      return;
    }
    if (!isPredictionValid(predictions[matchId])) return;

    setSaveStatus((current) => ({ ...current, [matchId]: 'saving' }));
    try {
      const saved = await persistPredictions([matchId]);
      setSaveStatus((current) => ({ ...current, [matchId]: saved ? 'saved' : 'blocked' }));
    } catch (saveError) {
      console.error('Unable to save prediction', saveError);
      setSaveStatus((current) => ({ ...current, [matchId]: 'error' }));
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const saved = await persistPredictions(Object.keys(predictions));
      window.alert(t(saved ? 'predictions.messages.savedAll' : 'predictions.messages.noValidPredictions'));
    } catch (saveError) {
      console.error('Unable to save predictions', saveError);
      window.alert(t('predictions.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const formatRound = (round) => {
    const key = league?.officialLeagueId === 12 ? CUP_ROUND_KEYS[round] : null;
    return key ? t(`predictions.${key}`) : t('predictions.round', { round });
  };

  if (loading && !league) {
    return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse">{t('predictions.loading')}</div>;
  }

  if (error || !league) {
    return <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center">{t('predictions.messages.loadError')}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      <header className="max-w-2xl mx-auto mb-8 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate(league.sportId ? `/leagues/${league.sportId}` : '/home')} className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]">
            ← {t('common.back')}
          </button>
          <div className="flex items-center gap-3 text-right">
            <Link to={`/leagues/${ligaId}/settings`} aria-label={t('predictions.settings')} className="bg-[#1A1C3A] border border-[#26283A] text-gray-400 hover:text-[#0077FF] hover:border-[#0077FF] p-2.5 rounded-xl">⚙️</Link>
            <div><Link to="/" className="block"><Logo size="sm" /></Link><span className="text-white block text-sm opacity-80">{league.name}</span></div>
          </div>
        </div>

        {isFootball && <div className="relative w-full"><select value={selectedRound} onChange={(event) => handleRoundChange(event.target.value)} className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 pr-10 rounded-2xl font-black italic uppercase text-[#0077FF] focus:outline-none appearance-none cursor-pointer text-sm tracking-wide">{rounds.map((round) => <option key={round} value={round}>{formatRound(round)}</option>)}</select><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#0077FF] pointer-events-none">▼</span></div>}
        <CalendarPicker selectedDate={selectedDate} gamesPerDay={gamesPerDay} onSelectDate={handleDateChange} />
      </header>

      <div className="grid gap-6 max-w-2xl mx-auto">
        {!loading && matches.length === 0 ? <p className="text-center p-10 opacity-30 font-black italic uppercase">{t('predictions.empty')}</p> : matches.map((match) => {
          const locked = hasMatchStarted(match.date);
          const status = saveStatus[match.id];
          return <div key={match.id} className={`relative bg-[#1A1C3A] border p-4 sm:p-8 rounded-[35px] shadow-2xl w-full overflow-hidden ${locked ? 'border-red-900/30 opacity-60' : 'border-[#26283A]'}`}>
            {locked && <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-600/20 border border-red-500/30 px-3 py-0.5 rounded-full text-[8px] font-black text-red-400 tracking-widest uppercase italic">{t('predictions.closed')}</div>}
            <div className="flex justify-between items-center gap-2 sm:gap-4 mt-2">
              <Team team={match.home_team} />
              <div className="flex flex-col items-center gap-2"><div className="flex items-center gap-1 sm:gap-3 bg-[#0A0E2A] p-2 sm:p-4 rounded-[25px] border border-[#26283A]"><ScoreInput disabled={locked} value={predictions[match.id]?.home ?? ''} onChange={(value) => handlePredictionChange(match.id, 'home', value)} onBlur={() => handleSingleSave(match.id)} /><span className="text-[#26283A] font-black italic text-lg sm:text-2xl">X</span><ScoreInput disabled={locked} value={predictions[match.id]?.away ?? ''} onChange={(value) => handlePredictionChange(match.id, 'away', value)} onBlur={() => handleSingleSave(match.id)} /></div><SaveStatus status={status} t={t} /></div>
              <Team team={match.away_team} />
            </div>
            <div className="mt-2 text-center text-[9px] sm:text-[10px] font-black text-[#B0C4DE] opacity-40 uppercase italic">{formatTime(match.date)}</div>
          </div>;
        })}
        <button onClick={handleSaveAll} disabled={saving} className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-xl font-black py-6 rounded-[25px] uppercase italic text-xl z-40 shadow-2xl ${saving ? 'bg-gray-700 cursor-not-allowed' : 'bg-[#0077FF] hover:bg-[#0066DD]'}`}>{saving ? t('predictions.saving') : t('predictions.confirm')}</button>
      </div>
      <BottomNav />
    </div>
  );
}

function Team({ team }) { return <div className="flex-1 flex flex-col items-center text-center gap-2"><img src={team?.url_logo} className="w-10 h-10 sm:w-14 sm:h-14 object-contain" alt={team?.name ?? ''} /><span className="text-[9px] sm:text-[11px] font-black uppercase tracking-tight leading-tight">{team?.name}</span></div>; }
function ScoreInput({ disabled, value, onChange, onBlur }) { return <input type="number" min="0" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className="w-10 h-10 sm:w-16 sm:h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-xl sm:text-3xl text-[#0077FF] outline-none disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="0" />; }
function SaveStatus({ status, t }) { const labels = { saving: ['text-yellow-500 animate-pulse', 'predictions.status.saving'], saved: ['text-green-400', 'predictions.status.saved'], blocked: ['text-red-500', 'predictions.status.blocked'], error: ['text-red-500', 'predictions.status.error'] }; const item = labels[status]; return <div className="h-3 flex items-center justify-center">{item && <span className={`text-[8px] font-black tracking-widest uppercase ${item[0]}`}>{t(item[1])}</span>}</div>; }
