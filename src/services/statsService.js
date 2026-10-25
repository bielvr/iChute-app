import { supabase } from '../supabaseClient';
import { getLeagueRanking, getAvailableSeasons } from './rankingService';
import { toInputDate } from '../utils/date';

export { getAvailableSeasons };

/**
 * Busca todas as previsões vinculadas aos IDs de partidas fornecidos,
 * particionando em blocos (chunks) e paginando com range para contornar
 * o limite padrão de 1.000 registros do PostgREST.
 *
 * @param {number|string} userLeagueId
 * @param {number[]} matchIds
 * @returns {Promise<Array>}
 */
async function fetchAllLeaguePredictions(userLeagueId, matchIds) {
  if (!matchIds || matchIds.length === 0) return [];

  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    chunks.push(matchIds.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const chunkData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('predictions')
          .select('user_id, match_id, points_earned, users(id, name)')
          .eq('user_league_id', Number(userLeagueId))
          .in('match_id', chunk)
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          chunkData.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page += 1;
          }
        }
      }

      return chunkData;
    })
  );

  return results.flat();
}

/**
 * Busca e consolida as estatísticas oficiais da liga:
 * 1. Ranking com gaps a partir da view oficial ranking_detalhado (idêntico à tela de Ranking).
 * 2. Melhores por rodada sem corte de truncamento do PostgREST.
 * 3. Hall da Fama da temporada (Mais Certeiro, Recorde em Rodada, Eficiência).
 *
 * @param {object} params
 * @param {number|string} params.userLeagueId
 * @param {number|string} params.officialLeagueId
 * @param {string} params.season
 */
export async function getLeagueStats({ userLeagueId, officialLeagueId, season }) {
  const numericUserLeagueId = Number(userLeagueId);
  const numericOfficialLeagueId = Number(officialLeagueId);
  const seasonStr = String(season);

  // 1. Busca dados do ranking oficial e partidas finalizadas em paralelo
  const [rankingData, matchesResult] = await Promise.all([
    getLeagueRanking(numericUserLeagueId, seasonStr),
    supabase
      .from('matches')
      .select('id, round, date, goals_home, goals_away, status')
      .eq('league_id', numericOfficialLeagueId)
      .eq('season', seasonStr)
      .not('goals_home', 'is', null)
      .order('round', { ascending: true })
      .order('date', { ascending: true }),
  ]);

  if (matchesResult.error) throw matchesResult.error;

  const matches = matchesResult.data || [];
  const officialRanking = rankingData || [];

  // ==========================================
  // SEÇÃO DE GAPS BASEADA NO RANKING OFICIAL
  // ==========================================
  const leaderPoints = officialRanking.length > 0 ? Number(officialRanking[0].total_points || 0) : 0;

  const rankingWithGaps = officialRanking.map((user, index) => {
    const isLeader = index === 0;
    const totalPoints = Number(user.total_points || 0);
    const cravadas = Number(user.cravadas || 0);
    const totalJogos = Number(user.total_jogos || 0);
    const aheadUser = index > 0 ? officialRanking[index - 1] : null;

    const diffToLeader = isLeader ? 0 : Math.max(0, leaderPoints - totalPoints);
    const diffToAhead = isLeader
      ? 0
      : Math.max(0, Number(aheadUser?.total_points || 0) - totalPoints);

    const exactPercentage =
      totalJogos > 0 ? Number(((cravadas / totalJogos) * 100).toFixed(1)) : 0;

    return {
      id: Number(user.user_id),
      name: user.user_name || `Participante ${user.user_id}`,
      totalPoints,
      cravadas,
      totalJogos,
      exactPercentage,
      position: index + 1,
      isLeader,
      diffToLeader,
      diffToAhead,
      aheadPosition: index,
      aheadName: aheadUser?.user_name ?? null,
    };
  });

  // ==========================================
  // CÁLCULO DE MELHORES POR RODADA E RECORDE
  // ==========================================
  // Mapeia matches por rodada ou data
  const hasRounds = matches.some((m) => m.round !== null && m.round !== undefined);
  const matchGroupMap = {};
  const validMatchIds = [];
  const roundMetaMap = {};

  matches.forEach((m) => {
    validMatchIds.push(m.id);

    const groupKey = hasRounds
      ? `round_${m.round}`
      : `date_${m.date ? toInputDate(m.date) : 'all'}`;

    matchGroupMap[m.id] = groupKey;

    if (!roundMetaMap[groupKey]) {
      roundMetaMap[groupKey] = {
        key: groupKey,
        label: hasRounds ? `Rodada ${m.round}` : m.date ? toInputDate(m.date) : 'Rodada',
        sortOrder: hasRounds
          ? Number(m.round)
          : m.date
          ? new Date(m.date).getTime()
          : 0,
      };
    }
  });

  // Busca todas as previsões associadas sem sofrer truncamento do PostgREST
  const allPredictions = await fetchAllLeaguePredictions(numericUserLeagueId, validMatchIds);

  // Agrupa pontos por rodada e por participante
  const roundUserScores = {}; // { [groupKey]: { [userId]: { name, points } } }

  allPredictions.forEach((p) => {
    const groupKey = matchGroupMap[p.match_id];
    if (!groupKey) return;

    const uid = Number(p.user_id);
    const userObj = Array.isArray(p.users) ? p.users[0] : p.users;
    const userName = userObj?.name || `Usuário ${uid}`;
    const points = Number(p.points_earned || 0);

    if (!roundUserScores[groupKey]) {
      roundUserScores[groupKey] = {};
    }

    if (!roundUserScores[groupKey][uid]) {
      roundUserScores[groupKey][uid] = {
        userId: uid,
        name: userName,
        points: 0,
      };
    }

    roundUserScores[groupKey][uid].points += points;
  });

  // Determina os melhores de cada rodada
  const bestByRound = Object.keys(roundMetaMap)
    .map((groupKey) => {
      const meta = roundMetaMap[groupKey];
      const scoresMap = roundUserScores[groupKey] || {};
      const scores = Object.values(scoresMap);

      if (scores.length === 0) return null;

      let maxPoints = -1;
      let minPoints = Infinity;
      let winners = [];
      let lowestUser = null;

      scores.forEach((item) => {
        if (item.points > maxPoints) {
          maxPoints = item.points;
          winners = [item.name];
        } else if (item.points === maxPoints) {
          winners.push(item.name);
        }

        if (item.points < minPoints) {
          minPoints = item.points;
          lowestUser = item;
        }
      });

      return {
        key: groupKey,
        label: meta.label,
        sortOrder: meta.sortOrder,
        points: Math.max(0, maxPoints),
        winners,
        winnerName: winners.join(', '),
        lowestUser,
      };
    })
    .filter(Boolean);

  bestByRound.sort((a, b) => a.sortOrder - b.sortOrder);

  // ==========================================
  // HALL DA FAMA / DESTAQUES DA TEMPORADA
  // ==========================================
  // 1. Mais Certeiro: participante com maior número de cravadas vindo do ranking_detalhado
  let topExactUser = null;
  if (rankingWithGaps.length > 0) {
    const sortedByExact = [...rankingWithGaps].sort((a, b) => {
      if (b.cravadas !== a.cravadas) return b.cravadas - a.cravadas;
      return b.exactPercentage - a.exactPercentage;
    });

    const top = sortedByExact[0];
    if (top && top.cravadas > 0) {
      topExactUser = {
        name: top.name,
        cravadas: top.cravadas,
        percentage: top.exactPercentage,
      };
    }
  }

  // 2. Recorde de Pontos em uma Rodada
  let recordRoundUser = null;
  let highestRoundScore = -1;

  bestByRound.forEach((r) => {
    if (r.points > highestRoundScore && r.winners.length > 0) {
      highestRoundScore = r.points;
      recordRoundUser = {
        name: r.winners.join(', '),
        points: r.points,
        roundLabel: r.label,
      };
    }
  });

  // 3. Secador da Rodada (menor pontuação registrada em rodada com palpites)
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

  // 4. Eficiência Geral da Liga
  const totalLeaguePoints = rankingWithGaps.reduce((acc, u) => acc + u.totalPoints, 0);
  const totalLeagueExacts = rankingWithGaps.reduce((acc, u) => acc + u.cravadas, 0);
  const totalLeagueGames = rankingWithGaps.reduce((acc, u) => acc + u.totalJogos, 0);
  const averagePointsPerPred =
    totalLeagueGames > 0 ? (totalLeaguePoints / totalLeagueGames).toFixed(1) : '0.0';

  const leagueEfficiency = {
    totalPoints: totalLeaguePoints,
    totalExacts: totalLeagueExacts,
    averagePointsPerPred,
    finishedMatches: matches.length,
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
    totalMatches: matches.length,
  };
}
