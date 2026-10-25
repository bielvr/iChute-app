import { supabase } from '../supabaseClient';
import { toInputDate } from '../utils/date';

/**
 * Busca as temporadas distintas da liga na tabela matches em ordem decrescente.
 * @param {number|string} officialLeagueId
 * @returns {Promise<string[]>}
 */
export async function getAvailableSeasons(officialLeagueId) {
  const { data, error } = await supabase
    .from('matches')
    .select('season')
    .eq('league_id', Number(officialLeagueId))
    .not('season', 'is', null);

  if (error) throw error;

  const rawSeasons = (data || []).map((m) => String(m.season)).filter(Boolean);
  const uniqueSeasons = [...new Set(rawSeasons)];
  uniqueSeasons.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return uniqueSeasons;
}

/**
 * Busca e calcula estatísticas consolidadas da liga para uma temporada.
 * @param {object} params
 * @param {number|string} params.userLeagueId
 * @param {number|string} params.officialLeagueId
 * @param {string} params.season
 */
export async function getLeagueStats({ userLeagueId, officialLeagueId, season }) {
  const numericUserLeagueId = Number(userLeagueId);
  const numericOfficialLeagueId = Number(officialLeagueId);
  const seasonStr = String(season);

  const [
    { data: matches, error: matchesError },
    { data: predictions, error: predictionsError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from('matches')
      .select('id, round, date, home_team_id, away_team_id, goals_home, goals_away, season, status')
      .eq('league_id', numericOfficialLeagueId)
      .eq('season', seasonStr)
      .eq('status', 'finished')
      .order('date', { ascending: true }),
    supabase
      .from('predictions')
      .select(`
        user_id,
        match_id,
        points_earned,
        prediction_home,
        prediction_away,
        users (id, name),
        match:matches!inner (
          id,
          round,
          date,
          season,
          status,
          goals_home,
          goals_away
        )
      `)
      .eq('user_league_id', numericUserLeagueId)
      .eq('match.season', seasonStr)
      .eq('match.status', 'finished'),
    supabase
      .from('user_league_members')
      .select('user_id, users(id, name)')
      .eq('user_league_id', numericUserLeagueId),
  ]);

  if (matchesError) throw matchesError;
  if (predictionsError) throw predictionsError;
  if (membersError) throw membersError;

  const validMatches = matches || [];
  const validPredictions = (predictions || []).map((p) => ({
    ...p,
    users: Array.isArray(p.users) ? p.users[0] : p.users,
    match: Array.isArray(p.match) ? p.match[0] : p.match,
  }));

  // Mapeia participantes da liga
  const usersMap = {};
  (members || []).forEach((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    const uid = Number(m.user_id);
    usersMap[uid] = {
      id: uid,
      name: u?.name || `Usuário ${uid}`,
    };
  });

  // Garante que qualquer participante com predição seja mapeado
  validPredictions.forEach((p) => {
    const uid = Number(p.user_id);
    if (!usersMap[uid]) {
      usersMap[uid] = {
        id: uid,
        name: p.users?.name || `Usuário ${uid}`,
      };
    }
  });

  // Estatísticas acumuladas por usuário
  const userStats = {};
  Object.keys(usersMap).forEach((uid) => {
    userStats[uid] = {
      id: Number(uid),
      name: usersMap[uid].name,
      totalPoints: 0,
      exactCount: 0,
      totalPredictions: 0,
    };
  });

  // Agrupamento por Rodada (ou Data na ausência de round)
  const roundPointsMap = {};
  const roundMetaMap = {};

  validPredictions.forEach((p) => {
    const uid = Number(p.user_id);
    const m = p.match;
    if (!m) return;

    const points = Number(p.points_earned || 0);
    const isExact =
      m.goals_home !== null &&
      m.goals_away !== null &&
      Number(p.prediction_home) === Number(m.goals_home) &&
      Number(p.prediction_away) === Number(m.goals_away);

    if (userStats[uid]) {
      userStats[uid].totalPoints += points;
      userStats[uid].totalPredictions += 1;
      if (isExact) userStats[uid].exactCount += 1;
    }

    const roundKey =
      m.round !== null && m.round !== undefined
        ? `round_${m.round}`
        : `date_${m.date ? toInputDate(m.date) : 'all'}`;

    if (!roundPointsMap[roundKey]) {
      roundPointsMap[roundKey] = {};
      roundMetaMap[roundKey] = {
        key: roundKey,
        round: m.round,
        date: m.date,
        label:
          m.round !== null && m.round !== undefined
            ? `Rodada ${m.round}`
            : m.date
            ? toInputDate(m.date)
            : 'Rodada',
        sortOrder:
          m.round !== null && m.round !== undefined
            ? Number(m.round)
            : m.date
            ? new Date(m.date).getTime()
            : 0,
      };
    }

    roundPointsMap[roundKey][uid] = (roundPointsMap[roundKey][uid] || 0) + points;
  });

  // Melhores pontuadores de cada rodada
  const bestByRound = Object.keys(roundPointsMap)
    .map((roundKey) => {
      const meta = roundMetaMap[roundKey];
      const scores = roundPointsMap[roundKey];
      const userIds = Object.keys(scores);

      if (userIds.length === 0) return null;

      let maxPoints = -1;
      let minPoints = Infinity;
      let winners = [];
      let lowestUser = null;

      userIds.forEach((uidStr) => {
        const uid = Number(uidStr);
        const pts = scores[uid];
        const user = usersMap[uid] || { id: uid, name: `Usuário ${uid}` };

        if (pts > maxPoints) {
          maxPoints = pts;
          winners = [{ id: uid, name: user.name, points: pts }];
        } else if (pts === maxPoints) {
          winners.push({ id: uid, name: user.name, points: pts });
        }

        if (pts < minPoints) {
          minPoints = pts;
          lowestUser = { id: uid, name: user.name, points: pts };
        }
      });

      return {
        key: roundKey,
        label: meta.label,
        round: meta.round,
        sortOrder: meta.sortOrder,
        points: Math.max(0, maxPoints),
        winners,
        lowestUser,
      };
    })
    .filter(Boolean);

  bestByRound.sort((a, b) => a.sortOrder - b.sortOrder);

  // Ranking geral com cálculo dos Gaps
  const sortedRanking = Object.values(userStats).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.exactCount !== a.exactCount) {
      return b.exactCount - a.exactCount;
    }
    return a.name.localeCompare(b.name);
  });

  const leaderPoints = sortedRanking.length > 0 ? sortedRanking[0].totalPoints : 0;

  const rankingWithGaps = sortedRanking.map((user, index) => {
    const position = index + 1;
    const isLeader = index === 0;
    const aheadUser = index > 0 ? sortedRanking[index - 1] : null;

    const diffToLeader = isLeader ? 0 : Math.max(0, leaderPoints - user.totalPoints);
    const diffToAhead = isLeader ? 0 : Math.max(0, aheadUser.totalPoints - user.totalPoints);

    const exactPercentage =
      user.totalPredictions > 0
        ? Number(((user.exactCount / user.totalPredictions) * 100).toFixed(1))
        : 0;

    return {
      ...user,
      position,
      isLeader,
      diffToLeader,
      diffToAhead,
      aheadPosition: index,
      aheadName: aheadUser?.name ?? null,
      exactPercentage,
    };
  });

  // Destaques da Liga
  let topExactUser = null;
  const usersWithPredictions = rankingWithGaps.filter((u) => u.totalPredictions > 0);
  if (usersWithPredictions.length > 0) {
    const sortedByExact = [...usersWithPredictions].sort((a, b) => {
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      return b.exactPercentage - a.exactPercentage;
    });
    const candidate = sortedByExact[0];
    if (candidate && candidate.exactCount > 0) {
      topExactUser = {
        id: candidate.id,
        name: candidate.name,
        exactCount: candidate.exactCount,
        percentage: candidate.exactPercentage,
      };
    }
  }

  // Maior pontuação em uma única rodada
  let recordRoundUser = null;
  let highestSingleRoundScore = -1;

  bestByRound.forEach((r) => {
    if (r.points > highestSingleRoundScore && r.winners.length > 0) {
      highestSingleRoundScore = r.points;
      recordRoundUser = {
        name: r.winners.map((w) => w.name).join(', '),
        points: r.points,
        roundLabel: r.label,
      };
    }
  });

  // Menor pontuação em rodada finalizada
  let worstRoundUser = null;
  let lowestRoundScore = Infinity;

  bestByRound.forEach((r) => {
    if (r.lowestUser && r.lowestUser.points < lowestRoundScore) {
      lowestRoundScore = r.lowestUser.points;
      worstRoundUser = {
        name: r.lowestUser.name,
        points: r.lowestUser.points,
        roundLabel: r.label,
      };
    }
  });

  // Eficiência geral da liga
  const totalLeaguePoints = validPredictions.reduce(
    (acc, p) => acc + Number(p.points_earned || 0),
    0
  );
  const totalLeagueExacts = rankingWithGaps.reduce((acc, u) => acc + u.exactCount, 0);
  const averagePointsPerPred =
    validPredictions.length > 0 ? (totalLeaguePoints / validPredictions.length).toFixed(1) : '0.0';

  const leagueEfficiency = {
    totalPoints: totalLeaguePoints,
    totalExacts: totalLeagueExacts,
    averagePointsPerPred,
    totalPredictions: validPredictions.length,
    finishedMatches: validMatches.length,
  };

  return {
    season: seasonStr,
    rankingWithGaps,
    bestByRound,
    highlights: {
      topExactUser,
      recordRoundUser,
      worstRoundUser,
      leagueEfficiency,
    },
    totalMatches: validMatches.length,
  };
}
