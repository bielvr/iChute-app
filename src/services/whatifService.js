import { supabase } from '../supabaseClient';

/**
 * Busca as temporadas distintas da liga na tabela matches de forma ordenada decrescente.
 * @param {number|string} officialLeagueId
 * @returns {Promise<string[]>}
 */
export async function getWhatIfSeasons(officialLeagueId) {
  const { data, error } = await supabase
    .from('matches')
    .select('season')
    .eq('league_id', Number(officialLeagueId))
    .not('season', 'is', null);

  if (error) throw error;

  const rawSeasons = (data || []).map((m) => String(m.season)).filter(Boolean);
  const uniqueSeasons = [...new Set(rawSeasons)];

  // Ordenação decrescente suportando anos numéricos ('2026', '2025') ou compostos ('20262027', '2025/2026')
  uniqueSeasons.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return uniqueSeasons;
}

/**
 * Recalcula o acumulador de times com base estrita nas partidas e palpites da temporada selecionada.
 */
function calculateSeasonStats({ matches, predictions, userId, userLeagueId }) {
  const statsMap = {};

  // Inicializa todo time que joga na temporada
  matches.forEach((m) => {
    [m.home_team_id, m.away_team_id].forEach((teamId) => {
      if (teamId && !statsMap[teamId]) {
        statsMap[teamId] = {
          user_id: Number(userId),
          user_league_id: Number(userLeagueId),
          team_id: teamId,
          jogos: 0,
          pts: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          diff: 0,
          acerto_v: 0,
          acerto_e: 0,
          acerto_d: 0,
          acerto_gols: 0,
          cravada: 0,
        };
      }
    });
  });

  // Acumula métricas a partir dos palpites do usuário
  predictions.forEach((p) => {
    const m = Array.isArray(p.match) ? p.match[0] : p.match;
    if (!m) return;
    if (
      p.prediction_home === null ||
      p.prediction_home === undefined ||
      p.prediction_away === null ||
      p.prediction_away === undefined
    ) {
      return;
    }

    const homeId = m.home_team_id;
    const awayId = m.away_team_id;

    const predHome = Number(p.prediction_home);
    const predAway = Number(p.prediction_away);

    const realHome = m.goals_home !== null && m.goals_home !== undefined ? Number(m.goals_home) : null;
    const realAway = m.goals_away !== null && m.goals_away !== undefined ? Number(m.goals_away) : null;
    const matchFinished = realHome !== null && realAway !== null;

    // Time da Casa
    if (statsMap[homeId]) {
      const stat = statsMap[homeId];
      stat.jogos += 1;
      stat.gf += predHome;
      stat.ga += predAway;
      stat.diff = stat.gf - stat.ga;

      if (predHome > predAway) {
        stat.w += 1;
        stat.pts += 3;
      } else if (predHome === predAway) {
        stat.d += 1;
        stat.pts += 1;
      } else {
        stat.l += 1;
      }

      if (matchFinished) {
        const isRealWin = realHome > realAway;
        const isRealDraw = realHome === realAway;
        const isRealLoss = realHome < realAway;

        const isPredWin = predHome > predAway;
        const isPredDraw = predHome === predAway;
        const isPredLoss = predHome < predAway;

        const isExact = realHome === predHome && realAway === predAway;
        const hasPointed =
          (isRealWin && isPredWin) || (isRealDraw && isPredDraw) || (isRealLoss && isPredLoss);

        if (isExact) stat.cravada += 1;
        if (isRealWin && isPredWin) stat.acerto_v += 1;
        if (isRealDraw && isPredDraw) stat.acerto_e += 1;
        if (isRealLoss && isPredLoss) stat.acerto_d += 1;
        if (hasPointed && predHome === realHome) stat.acerto_gols += 1;
      }
    }

    // Time Visitante
    if (statsMap[awayId]) {
      const stat = statsMap[awayId];
      stat.jogos += 1;
      stat.gf += predAway;
      stat.ga += predHome;
      stat.diff = stat.gf - stat.ga;

      if (predAway > predHome) {
        stat.w += 1;
        stat.pts += 3;
      } else if (predAway === predHome) {
        stat.d += 1;
        stat.pts += 1;
      } else {
        stat.l += 1;
      }

      if (matchFinished) {
        const isRealWin = realAway > realHome;
        const isRealDraw = realAway === realHome;
        const isRealLoss = realAway < realHome;

        const isPredWin = predAway > predHome;
        const isPredDraw = predAway === predHome;
        const isPredLoss = predAway < predHome;

        const isExact = realHome === predHome && realAway === predAway;
        const hasPointed =
          (isRealWin && isPredWin) || (isRealDraw && isPredDraw) || (isRealLoss && isPredLoss);

        if (isExact) stat.cravada += 1;
        if (isRealWin && isPredWin) stat.acerto_v += 1;
        if (isRealDraw && isPredDraw) stat.acerto_e += 1;
        if (isRealLoss && isPredLoss) stat.acerto_d += 1;
        if (hasPointed && predAway === realAway) stat.acerto_gols += 1;
      }
    }
  });

  return Object.values(statsMap);
}

/**
 * Carrega os dados do cenário What If com filtragem estrita pela temporada selecionada.
 * @param {object} params
 * @param {number|string} params.userId
 * @param {number|string} params.userLeagueId
 * @param {number|string} params.officialLeagueId
 * @param {string} params.season
 */
export async function getWhatIfScenario({ userId, userLeagueId, officialLeagueId, season }) {
  const numericUserId = Number(userId);
  const numericUserLeagueId = Number(userLeagueId);
  const numericOfficialLeagueId = Number(officialLeagueId);
  const seasonStr = String(season);

  const [
    { data: teams, error: teamsError },
    { data: matches, error: matchesError },
    { data: predictions, error: predictionsError },
  ] = await Promise.all([
    supabase.from('teams').select('id, name, url_logo'),
    supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, season')
      .eq('league_id', numericOfficialLeagueId)
      .eq('season', seasonStr),
    supabase
      .from('predictions')
      .select(`
        id,
        prediction_home,
        prediction_away,
        match:matches!inner (
          id,
          round,
          goals_home,
          goals_away,
          home_team_id,
          away_team_id,
          season,
          home_team:teams!matches_home_team_id_fkey (id, name, url_logo),
          away_team:teams!matches_away_team_id_fkey (id, name, url_logo)
        )
      `)
      .eq('user_id', numericUserId)
      .eq('user_league_id', numericUserLeagueId)
      .eq('match.season', seasonStr),
  ]);

  if (teamsError) throw teamsError;
  if (matchesError) throw matchesError;
  if (predictionsError) throw predictionsError;

  const validMatches = matches || [];
  const validPredictions = (predictions || []).map((p) => ({
    ...p,
    match: Array.isArray(p.match) ? p.match[0] : p.match,
  }));

  // Recalcula acumulador estritamente para a temporada filtrada
  const stats = calculateSeasonStats({
    matches: validMatches,
    predictions: validPredictions,
    userId: numericUserId,
    userLeagueId: numericUserLeagueId,
  });

  return {
    stats,
    teams: teams || [],
    matches: validMatches,
    predictions: validPredictions,
  };
}
