export async function getGlobalRanking(officialLeagueId, season = null) {
  let query = supabase
    .from('predictions')
    .select('user_id, prediction_home, prediction_away, users(name), matches!inner(goals_home, goals_away, status, league_id, season)')
    .in('matches.status', ['finished', 'OFF', 'off', 'FINAL', 'final'])
    .eq('matches.league_id', officialLeagueId);

  if (season) {
    query = query.eq('matches.season', season);
  }

  const { data, error } = await query;
  if (error) throw error;

  const users = data.reduce((ranking, prediction) => {
    if (!prediction.user_id || !prediction.users || !prediction.matches) return ranking;
    const item = ranking[prediction.user_id] ??= {
      user_id: prediction.user_id,
      user_name: prediction.users.name,
      exact: 0,
      outcome: 0,
      goals: 0,
      total_matches: 0
    };
    item.total_matches += 1;
    const { goals_home: home, goals_away: away } = prediction.matches;
    const predictionHome = prediction.prediction_home;
    const predictionAway = prediction.prediction_away;

    if (home === predictionHome && away === predictionAway) {
      item.exact += 1;
      return ranking;
    }
    if (Math.sign(home - away) === Math.sign(predictionHome - predictionAway)) item.outcome += 1;
    if (home === predictionHome) item.goals += 1;
    if (away === predictionAway) item.goals += 1;
    return ranking;
  }, {});

  return Object.values(users).sort((a, b) => b.exact - a.exact || b.outcome - a.outcome || b.goals - a.goals);
}