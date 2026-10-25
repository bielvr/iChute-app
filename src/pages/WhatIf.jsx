import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/layout/BottomNav';
import { getCurrentUser } from '../services/authService';
import { getUserLeagueDetails } from '../services/leagueService';
import { getWhatIfScenario, getWhatIfSeasons } from '../services/whatifService';
import {
  getNhlTeamMetadata,
  getWorldCupGroup,
  NHL_CONFERENCES,
  NHL_DIVISIONS,
  WORLD_CUP_GROUP_IDS,
} from '../config/whatif';

const sortTeams = (teams) =>
  [...teams].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.goalDifference - a.goalDifference
  );

function formatSeasonDisplay(season) {
  if (!season) return '';
  const str = String(season);
  if (str.length === 8 && /^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}/${str.slice(4)}`;
  }
  return str;
}

export default function WhatIf() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [league, setLeague] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [teams, setTeams] = useState([]);
  const [rawPredictions, setRawPredictions] = useState([]);
  const [conference, setConference] = useState('all');
  const [division, setDivision] = useState('all');
  const [group, setGroup] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isFootball = league?.sportId === 1;
  const isWorldCup = league?.officialLeagueId === 12;

  // Carregamento inicial da liga e lista de temporadas
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

        const availableSeasons = await getWhatIfSeasons(userLeague.officialLeagueId);
        if (!isMounted) return;

        setSeasons(availableSeasons);
        if (availableSeasons.length > 0) {
          setSelectedSeason(availableSeasons[0]);
        }
      } catch (loadError) {
        console.error('Unable to initialize what-if seasons', loadError);
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

  // Carregamento do cenário ao mudar selectedSeason ou league
  useEffect(() => {
    if (!league || !selectedSeason) return;
    let isMounted = true;

    const loadScenario = async () => {
      setLoading(true);
      setError(false);
      try {
        const user = await getCurrentUser();
        if (!user) {
          navigate('/');
          return;
        }

        const scenario = await getWhatIfScenario({
          userId: user.id,
          userLeagueId: league.id,
          officialLeagueId: league.officialLeagueId,
          season: selectedSeason,
        });

        if (!isMounted) return;
        setTeams(buildTeams(scenario));
        setRawPredictions(scenario.predictions || []);
      } catch (loadError) {
        console.error('Unable to load what-if scenario', loadError);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadScenario();
    return () => {
      isMounted = false;
    };
  }, [league, selectedSeason, navigate]);

  const visibleTeams = useMemo(
    () =>
      sortTeams(
        teams.filter((team) =>
          !isFootball
            ? (conference === 'all' || team.conference === conference) &&
              (division === 'all' || team.division === division)
            : !isWorldCup || group === 'all' || team.group === group
        )
      ),
    [teams, isFootball, isWorldCup, conference, division, group]
  );

  if (loadingSeasons || (loading && !teams.length)) return <State label={t('whatIf.loading')} />;
  if (error || !league) return <State label={t('whatIf.messages.loadError')} />;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      <header className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3 mb-6">
        <button
          onClick={() => navigate(league.sportId ? `/leagues/${league.sportId}` : '/home')}
          className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]"
        >
          ← {t('common.back')}
        </button>

        <div className="flex items-center gap-3">
          {seasons.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedSeason}
                onChange={(event) => setSelectedSeason(event.target.value)}
                className="bg-[#1A1C3A] border border-[#26283A] text-white font-bold rounded-xl px-4 py-2 text-xs outline-none focus:border-[#0077FF] cursor-pointer"
                aria-label="Temporada"
              >
                {seasons.map((seasonOption) => (
                  <option key={seasonOption} value={seasonOption}>
                    {formatSeasonDisplay(seasonOption)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-right">
            <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter leading-none">
              {t('whatIf.title')}
            </h1>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mt-1">
              {league.name}
            </span>
          </div>
        </div>
      </header>

      {/* Filtros Fixos no Topo na rolagem */}
      {!isFootball && (
        <NhlFilters
          conference={conference}
          division={division}
          setConference={setConference}
          setDivision={setDivision}
          t={t}
        />
      )}
      {isWorldCup && <WorldCupFilter group={group} setGroup={setGroup} t={t} />}

      <StandingsTable
        teams={visibleTeams}
        isFootball={isFootball}
        isWorldCup={isWorldCup}
        predictions={rawPredictions}
        selectedSeason={selectedSeason}
        loading={loading}
        t={t}
      />

      <BottomNav />
    </div>
  );
}

function buildTeams({ stats, teams, matches }) {
  const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
  const matchesByTeam = matches.reduce((count, match) => {
    count[match.home_team_id] = (count[match.home_team_id] ?? 0) + 1;
    count[match.away_team_id] = (count[match.away_team_id] ?? 0) + 1;
    return count;
  }, {});

  return stats.map((row) => {
    const team = teamById[row.team_id] ?? {};
    const nhl = getNhlTeamMetadata(team.name);
    return {
      id: row.team_id,
      name: team.name ?? 'Unknown',
      logo: team.url_logo,
      games: row.jogos,
      wins: row.w,
      draws: row.d,
      losses: row.l,
      points: row.pts,
      pointsPercentage: row.jogos > 0 ? (row.pts / (row.jogos * 2)).toFixed(2) : '0.00',
      goalsFor: row.gf,
      goalsAgainst: row.ga,
      goalDifference: row.diff,
      correctWins: row.acerto_v,
      correctDraws: row.acerto_e,
      correctLosses: row.acerto_d,
      correctGoals: row.acerto_gols,
      exact: row.cravada,
      withoutPrediction: Math.max(0, (matchesByTeam[row.team_id] ?? 38) - row.jogos),
      conference: nhl.conference,
      division: nhl.division,
      group: getWorldCupGroup(row.team_id),
    };
  });
}

function NhlFilters({ conference, division, setConference, setDivision, t }) {
  return (
    <div className="sticky top-0 z-30 max-w-7xl mx-auto grid grid-cols-2 gap-4 mb-6 bg-[#1A1C3A]/90 backdrop-blur-md p-4 rounded-[25px] border border-[#26283A] shadow-xl">
      <Select
        label={t('whatIf.conference')}
        value={conference}
        setValue={setConference}
        options={NHL_CONFERENCES}
        prefix="whatIf.conferences"
        t={t}
      />
      <Select
        label={t('whatIf.division')}
        value={division}
        setValue={setDivision}
        options={NHL_DIVISIONS}
        prefix="whatIf.divisions"
        t={t}
      />
    </div>
  );
}

function WorldCupFilter({ group, setGroup, t }) {
  return (
    <div className="sticky top-0 z-30 max-w-7xl mx-auto mb-6 bg-[#1A1C3A]/90 backdrop-blur-md p-4 rounded-[25px] border border-[#26283A] shadow-xl">
      <Select
        label={t('whatIf.group')}
        value={group}
        setValue={setGroup}
        options={WORLD_CUP_GROUP_IDS}
        prefix="whatIf.groups"
        t={t}
      />
    </div>
  );
}

function Select({ label, value, setValue, options, prefix, t }) {
  return (
    <div>
      <label className="block text-[8px] font-black uppercase text-gray-400 mb-2 pl-1">{label}</label>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full bg-[#0A0E2A] border border-[#26283A] text-xs font-bold rounded-xl p-3 outline-none text-white cursor-pointer"
      >
        <option value="all">{t('whatIf.all')}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`${prefix}.${option}`, { defaultValue: option })}
          </option>
        ))}
      </select>
    </div>
  );
}

function StandingsTable({ teams, isFootball, isWorldCup, predictions = [], selectedSeason, loading, t }) {
  const [drawerState, setDrawerState] = useState({
    isOpen: false,
    team: null,
    metricLabel: '',
    matchesList: [],
  });

  const headers = [
    ['games', 'games'],
    ['wins', 'wins'],
    [isFootball ? 'draws' : 'otl', isFootball ? 'draws' : 'otl'],
    ['losses', 'losses'],
    ['points', 'points'],
    ...(!isFootball ? [['percentage', 'pointsPercentage']] : []),
    ['goalsFor', 'goalsFor'],
    ['goalsAgainst', 'goalsAgainst'],
    ['difference', 'goalDifference'],
    ['correctWins', 'correctWins'],
    ...(isFootball ? [['correctDraws', 'correctDraws']] : []),
    ['correctLosses', 'correctLosses'],
    ['correctGoals', 'correctGoals'],
    ['exact', 'exact'],
    ['withoutPrediction', 'withoutPrediction'],
  ];

  const getColumnColor = (label) => {
    switch (label) {
      case 'correctWins':
        return 'text-green-500';
      case 'correctDraws':
        return 'text-orange-400';
      case 'correctLosses':
        return 'text-red-500';
      case 'correctGoals':
        return 'text-yellow-500';
      case 'exact':
        return 'text-[#0077FF] font-black';
      case 'withoutPrediction':
        return 'text-gray-500';
      case 'points':
        return 'font-black text-[#0077FF]';
      default:
        return '';
    }
  };

  const handleCellClick = (team, label) => {
    const filteredMatches = filterMatchesByMetric({
      predictions,
      teamId: team.id,
      metricType: label,
      season: selectedSeason,
    });

    setDrawerState({
      isOpen: true,
      team,
      metricLabel: label,
      matchesList: filteredMatches,
    });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto bg-[#1A1C3A] border border-[#26283A] rounded-[24px] sm:rounded-[35px] shadow-2xl overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-[#0A0E2A]/60 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="text-[#0077FF] text-xs font-black tracking-wider animate-pulse">
              {t('whatIf.loading')}
            </div>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-[#0A0E2A] border-b border-[#26283A] text-gray-400 text-[10px] font-black uppercase italic tracking-wider">
                <th className="py-4 px-4 sticky left-0 z-20 bg-[#0A0E2A] border-r border-[#26283A] shadow-[4px_0_12px_rgba(0,0,0,0.6)] w-[180px] min-w-[180px] sm:w-[220px] sm:min-w-[220px]">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center">{t('whatIf.table.position')}</span>
                    <span>{t('whatIf.table.team')}</span>
                  </div>
                </th>

                {isWorldCup && <th className="py-4 px-4 text-center min-w-[70px]">{t('whatIf.table.group')}</th>}

                {headers.map(([label]) => (
                  <th
                    key={label}
                    className={`py-4 px-4 text-center min-w-[80px] whitespace-nowrap ${getColumnColor(label)}`}
                  >
                    {t(`whatIf.table.${label}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26283A] text-xs font-bold">
              {teams.map((team, index) => (
                <tr key={team.id} className="hover:bg-[#0A0E2A]/40 transition-colors group">
                  <td className="py-3.5 px-4 sticky left-0 z-10 bg-[#1A1C3A] group-hover:bg-[#121431] border-r border-[#26283A] shadow-[4px_0_12px_rgba(0,0,0,0.6)]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center text-gray-500 text-[11px] font-black flex-shrink-0">
                        {index + 1}º
                      </span>
                      <img src={team.logo} className="w-6 h-6 object-contain flex-shrink-0" alt="" />
                      <span className="uppercase truncate text-white text-xs tracking-wide max-w-[100px] sm:max-w-[130px]">
                        {team.name}
                      </span>
                    </div>
                  </td>

                  {isWorldCup && (
                    <td className="py-3.5 px-4 text-center">
                      {t(`whatIf.groups.${team.group}`, { defaultValue: team.group })}
                    </td>
                  )}

                  {headers.map(([label, property]) => {
                    const isInteractive = [
                      'correctWins',
                      'correctDraws',
                      'correctLosses',
                      'correctGoals',
                      'exact',
                    ].includes(label);
                    const rawValue = team[property];
                    const formattedValue =
                      property === 'goalDifference' && rawValue > 0 ? `+${rawValue}` : rawValue;
                    const canClick = isInteractive && Number(rawValue) > 0;

                    return (
                      <td
                        key={label}
                        onClick={() => canClick && handleCellClick(team, label)}
                        className={`py-3.5 px-4 text-center text-sm font-extrabold whitespace-nowrap ${getColumnColor(
                          label
                        )} ${
                          canClick
                            ? 'cursor-pointer hover:bg-white/10 active:scale-95 transition-all rounded-lg select-none'
                            : ''
                        }`}
                      >
                        {formattedValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <MatchesDrawer
        isOpen={drawerState.isOpen}
        onClose={() => setDrawerState((prev) => ({ ...prev, isOpen: false }))}
        team={drawerState.team}
        metricLabel={drawerState.metricLabel}
        matchesList={drawerState.matchesList}
        selectedSeason={selectedSeason}
        t={t}
      />
    </>
  );
}

function MatchesDrawer({ isOpen, onClose, team, metricLabel, matchesList, selectedSeason, t }) {
  if (!isOpen || !team) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-md bg-[#1A1C3A] h-full shadow-2xl overflow-y-auto border-l border-[#26283A] flex flex-col">
        {/* Header Drawer Fixo no Topo */}
        <div className="sticky top-0 z-20 bg-[#1A1C3A] p-6 border-b border-[#26283A] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Detalhamento</span>
              {selectedSeason && (
                <span className="text-[10px] bg-[#0A0E2A] text-gray-400 px-2 py-0.5 rounded-md border border-[#26283A] font-bold">
                  {formatSeasonDisplay(selectedSeason)}
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mt-1">
              <img src={team.logo} className="w-6 h-6 object-contain" alt="" />
              {team.name} •{' '}
              <span className="capitalize text-[#0077FF]">
                {t(`whatIf.table.${metricLabel}`, { defaultValue: metricLabel })}
              </span>
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-xl px-2">
            ✕
          </button>
        </div>

        {/* Match List */}
        <div className="p-6 space-y-4 pb-32 flex-1">
          {matchesList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 font-bold text-xs uppercase">
              Nenhum jogo encontrado
            </div>
          ) : (
            matchesList.map((item) => (
              <div key={item.id} className="bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
                <div className="text-[10px] text-gray-400 font-bold mb-2 uppercase text-center">
                  Rodada {item.match?.round ?? '-'}
                </div>

                {/* Grid de 3 colunas: [1fr (Mandante) | auto (Placar) | 1fr (Visitante)] */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-black text-white">
                  {/* Mandante */}
                  <div className="flex items-center gap-2 justify-end min-w-0">
                    <span className="truncate text-right">{item.match?.home_team?.name}</span>
                    <img
                      src={item.match?.home_team?.url_logo}
                      className="w-5 h-5 object-contain flex-shrink-0"
                      alt=""
                    />
                  </div>

                  {/* Caixa de Placar Central */}
                  <div className="px-3 py-1.5 bg-[#1A1C3A] rounded-xl border border-[#26283A] text-center flex-shrink-0 mx-1">
                    <div className="text-base tracking-widest">
                      {item.match?.goals_home} x {item.match?.goals_away}
                    </div>
                    <div className="text-[9px] text-blue-400 font-normal mt-0.5 whitespace-nowrap">
                      Palpite: {item.prediction_home} x {item.prediction_away}
                    </div>
                  </div>

                  {/* Visitante */}
                  <div className="flex items-center gap-2 justify-start min-w-0">
                    <img
                      src={item.match?.away_team?.url_logo}
                      className="w-5 h-5 object-contain flex-shrink-0"
                      alt=""
                    />
                    <span className="truncate text-left">{item.match?.away_team?.name}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function filterMatchesByMetric({ predictions, teamId, metricType, season }) {
  if (!predictions || !Array.isArray(predictions)) return [];

  return predictions.filter((p) => {
    const m = p.match;
    if (!m) return false;

    // Filtra estritamente pela temporada selecionada
    if (season && m.season && String(m.season) !== String(season)) {
      return false;
    }

    // Apenas partidas concluídas
    if (m.goals_home === null || m.goals_away === null) return false;

    const targetId = Number(teamId);
    const isHome = Number(m.home_team_id) === targetId;
    const isAway = Number(m.away_team_id) === targetId;

    if (!isHome && !isAway) return false;

    const teamReal = isHome ? Number(m.goals_home) : Number(m.goals_away);
    const oppReal = isHome ? Number(m.goals_away) : Number(m.goals_home);

    const teamPred = isHome ? Number(p.prediction_home) : Number(p.prediction_away);
    const oppPred = isHome ? Number(p.prediction_away) : Number(p.prediction_home);

    const isExact = teamReal === teamPred && oppReal === oppPred;

    const isTeamWin = teamReal > oppReal;
    const isPredWin = teamPred > oppPred;

    const isTeamDraw = teamReal === oppReal;
    const isPredDraw = teamPred === oppPred;

    const isTeamLoss = teamReal < oppReal;
    const isPredLoss = teamPred < oppPred;

    const hasPointed =
      (isTeamWin && isPredWin) || (isTeamDraw && isPredDraw) || (isTeamLoss && isPredLoss);

    switch (metricType) {
      case 'exact':
        return isExact;

      case 'correctWins':
        return isTeamWin && isPredWin;

      case 'correctDraws':
        return isTeamDraw && isPredDraw;

      case 'correctLosses':
        return isTeamLoss && isPredLoss;

      case 'correctGoals':
        return hasPointed && teamPred === teamReal;

      default:
        return false;
    }
  });
}

function State({ label }) {
  return (
    <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse tracking-widest">
      {label}
    </div>
  );
}
