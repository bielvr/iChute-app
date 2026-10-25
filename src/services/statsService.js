import { supabase } from '../supabaseClient';
import { getLeagueRanking, getAvailableSeasons } from './rankingService';
import { toInputDate } from '../utils/date';

export { getAvailableSeasons };

/**
 * Busca todas as previsões da liga vinculadas aos IDs de partidas fornecidos,
 * particionando em blocos (chunks) com paginação por range para contornar
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
          .select('user_id, match_id, points_earned, prediction_home, prediction_away, users(id, name)')
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
 * Busca e consolida todas as estatísticas oficiais e o histórico cronológico da liga:
 * 1. Ranking oficial e Gaps (da view ranking_detalhado via getLeagueRanking).
 * 2. Histórico cronológico rodada a rodada (maiores pontuadores, líder acumulado e gap para o 2º).
 * 3. Quadro de líderes da liderança (quantas rodadas na ponta e quais rodadas).
 * 4. Reis da rodada (quantas vezes foi o maior pontuador).
 * 5. Hall da Fama (Mais certeiro, recorde de rodada, etc.).
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

  // 1. Busca em paralelo: Ranking oficial consolidado e partidas finalizadas
  const [rankingData, matchesResult] = await Promise.all([
    getLeagueRanking(numericUserLeagueId, seasonStr),
    supabase
      .from('matches')
      .select('id, round, goals_home, goals_away, status, date')
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
  // PARTE 1: GAPS DA TABELA ATUAL (RANKING OFICIAL)
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
      vencedorBonus: Number(user.vencedor_bonus || 0),
      vencedorOnly: Number(user.vencedor_only || 0),
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
  // PARTE 2: HISTÓRICO RODADA A RODADA
  // ==========================================
  // Identifica rodadas ou datas únicas de jogos concluídos
  const hasRounds = matches.some((m) => m.round !== null && m.round !== undefined);
  const matchMap = new Map();
  const validMatchIds = [];
  const roundMetaMap = {};

  matches.forEach((m) => {
    validMatchIds.push(m.id);
    matchMap.set(m.id, m);

    const groupKey = hasRounds
      ? String(m.round)
      : m.date
      ? toInputDate(m.date)
      : 'all';

    if (!roundMetaMap[groupKey]) {
      roundMetaMap[groupKey] = {
        key: groupKey,
        label: hasRounds ? `Rodada ${m.round}` : m.date ? toInputDate(m.date) : 'Rodada',
        sortOrder: hasRounds ? Number(m.round) : m.date ? new Date(m.date).getTime() : 0,
      };
    }
  });

  // Busca todas as previsões vinculadas sem truncamento
  const allPredictions = await fetchAllLeaguePredictions(numericUserLeagueId, validMatchIds);

  // Agrupa pontos e cravadas por rodada e por participante
  const roundUserScores = {}; // groupKey -> { [userId]: { name, points, exacts } }

  allPredictions.forEach((p) => {
    const m = matchMap.get(p.match_id);
    if (!m) return;

    const groupKey = hasRounds
      ? String(m.round)
      : m.date
      ? toInputDate(m.date)
      : 'all';

    const uid = Number(p.user_id);
    const userObj = Array.isArray(p.users) ? p.users[0] : p.users;
    const userName = userObj?.name || `Usuário ${uid}`;
    const points = Number(p.points_earned || 0);

    const isExact =
      p.prediction_home !== null &&
      p.prediction_away !== null &&
      m.goals_home !== null &&
      m.goals_away !== null &&
      Number(p.prediction_home) === Number(m.goals_home) &&
      Number(p.prediction_away) === Number(m.goals_away);

    if (!roundUserScores[groupKey]) {
      roundUserScores[groupKey] = {};
    }

    if (!roundUserScores[groupKey][uid]) {
      roundUserScores[groupKey][uid] = {
        userId: uid,
        name: userName,
        points: 0,
        exacts: 0,
      };
    }

    roundUserScores[groupKey][uid].points += points;
    if (isExact) {
      roundUserScores[groupKey][uid].exacts += 1;
    }
  });

  // Ordenação cronológica das rodadas
  const sortedRoundKeys = Object.keys(roundMetaMap).sort(
    (a, b) => roundMetaMap[a].sortOrder - roundMetaMap[b].sortOrder
  );

  // Acumuladores ao longo do tempo (rodada a rodada)
  const cumulativeScores = {}; // userId -> { id, name, points, exacts }
  const bestRoundCounts = {}; // userId -> total de vezes campeão da rodada
  const bestRoundRounds = {}; // userId -> [roundLabel]
  const leadershipCounts = {}; // userId -> total de rodadas na liderança
  const leadershipRounds = {}; // userId -> [roundLabel]

  // Inicializa com participantes do ranking oficial
  rankingWithGaps.forEach((u) => {
    cumulativeScores[u.id] = {
      id: u.id,
      name: u.name,
      points: 0,
      exacts: 0,
    };
    bestRoundCounts[u.id] = 0;
    bestRoundRounds[u.id] = [];
    leadershipCounts[u.id] = 0;
    leadershipRounds[u.id] = [];
  });

  const roundHistory = [];

  sortedRoundKeys.forEach((groupKey) => {
    const meta = roundMetaMap[groupKey];
    const scoresMap = roundUserScores[groupKey] || {};
    const participantIds = Object.keys(scoresMap).map(Number);

    if (participantIds.length === 0) return;

    // 1. Maior pontuador da rodada específica
    let maxRoundPoints = -1;
    participantIds.forEach((uid) => {
      const pts = scoresMap[uid].points;
      if (pts > maxRoundPoints) maxRoundPoints = pts;
    });

    const roundWinners = [];
    participantIds.forEach((uid) => {
      const item = scoresMap[uid];

      // Acumula pontuação da rodada no total acumulado
      if (cumulativeScores[uid]) {
        cumulativeScores[uid].points += item.points;
        cumulativeScores[uid].exacts += item.exacts;
      } else {
        cumulativeScores[uid] = {
          id: uid,
          name: item.name,
          points: item.points,
          exacts: item.exacts,
        };
      }

      // Se foi o vencedor da rodada (ou empatado na pontuação máxima)
      if (item.points === maxRoundPoints && maxRoundPoints >= 0) {
        bestRoundCounts[uid] = (bestRoundCounts[uid] || 0) + 1;
        bestRoundRounds[uid] = bestRoundRounds[uid] || [];
        bestRoundRounds[uid].push(meta.label);

        roundWinners.push({
          id: uid,
          name: item.name,
          points: item.points,
          timesWon: bestRoundCounts[uid],
        });
      }
    });

    // 2. Classificação acumulada ao término desta rodada
    const currentStandings = Object.values(cumulativeScores)
      .filter((u) => u.points > 0 || u.exacts > 0)
      .sort((a, b) => b.points - a.points || b.exacts - a.exacts || a.name.localeCompare(b.name));

    if (currentStandings.length > 0) {
      const roundLeader = currentStandings[0];
      const secondPlace = currentStandings[1] || null;

      leadershipCounts[roundLeader.id] = (leadershipCounts[roundLeader.id] || 0) + 1;
      leadershipRounds[roundLeader.id] = leadershipRounds[roundLeader.id] || [];
      leadershipRounds[roundLeader.id].push(meta.label);

      let gapText = 'Líder isolado';
      if (secondPlace) {
        const pointDiff = roundLeader.points - secondPlace.points;
        if (pointDiff > 0) {
          gapText = `+${pointDiff} pts`;
        } else {
          const exactDiff = roundLeader.exacts - secondPlace.exacts;
          gapText = `0 (+${exactDiff} c)`;
        }
      }

      roundHistory.push({
        key: meta.key,
        round: meta.key,
        label: meta.label,
        sortOrder: meta.sortOrder,
        bestPerformers: roundWinners,
        bestScore: Math.max(0, maxRoundPoints),
        leader: {
          id: roundLeader.id,
          name: roundLeader.name,
          cumulativePoints: roundLeader.points,
          cumulativeExacts: roundLeader.exacts,
          gapText,
          roundsLeadingCount: leadershipCounts[roundLeader.id],
        },
      });
    }
  });

  // ==========================================
  // PARTE 3: QUADRO DE LÍDERES & REIS DA RODADA
  // ==========================================
  // Quadro de Líderes na Ponta (ranqueado por quantas rodadas terminou em 1º)
  const leadershipBoard = Object.keys(leadershipCounts)
    .map((uidStr) => {
      const uid = Number(uidStr);
      const roundsCount = leadershipCounts[uid] || 0;
      if (roundsCount === 0) return null;

      const userName =
        cumulativeScores[uid]?.name ||
        rankingWithGaps.find((u) => u.id === uid)?.name ||
        `Usuário ${uid}`;

      const percentage =
        roundHistory.length > 0
          ? Number(((roundsCount / roundHistory.length) * 100).toFixed(1))
          : 0;

      return {
        userId: uid,
        name: userName,
        roundsCount,
        roundsList: leadershipRounds[uid] || [],
        percentage,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.roundsCount - a.roundsCount || a.name.localeCompare(b.name));

  // Reis da Rodada (ranqueado por quantas vezes foi o maior pontuador)
  const roundKingsBoard = Object.keys(bestRoundCounts)
    .map((uidStr) => {
      const uid = Number(uidStr);
      const winsCount = bestRoundCounts[uid] || 0;
      if (winsCount === 0) return null;

      const userName =
        cumulativeScores[uid]?.name ||
        rankingWithGaps.find((u) => u.id === uid)?.name ||
        `Usuário ${uid}`;

      return {
        userId: uid,
        name: userName,
        winsCount,
        roundsList: bestRoundRounds[uid] || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.winsCount - a.winsCount || a.name.localeCompare(b.name));

  // ==========================================
  // PARTE 4: DESTAQUES DA TEMPORADA
  // ==========================================
  // 1. Mais Certeiro: participante com maior número de cravadas do ranking oficial
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
  let highestSingleRoundScore = -1;

  roundHistory.forEach((r) => {
    if (r.bestScore > highestSingleRoundScore && r.bestPerformers?.length > 0) {
      highestSingleRoundScore = r.bestScore;
      recordRoundUser = {
        name: r.bestPerformers.map((w) => w.name).join(', '),
        points: r.bestScore,
        roundLabel: r.label,
      };
    }
  });

  // 3. Menor Pontuação da Rodada ("Secador")
  let worstRoundUser = null;
  let lowestSingleRoundScore = Infinity;

  Object.keys(roundUserScores).forEach((groupKey) => {
    const meta = roundMetaMap[groupKey];
    const scores = Object.values(roundUserScores[groupKey] || {});
    scores.forEach((item) => {
      if (item.points < lowestSingleRoundScore) {
        lowestSingleRoundScore = item.points;
        worstRoundUser = {
          name: item.name,
          points: item.points,
          roundLabel: meta?.label || 'Rodada',
        };
      }
    });
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
    roundHistory,
    leadershipBoard,
    roundKingsBoard,
    highlights: {
      topExactUser,
      recordRoundUser,
      worstRoundUser,
      leagueEfficiency,
    },
    totalMatches: matches.length,
  };
}
