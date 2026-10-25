import { supabase } from '../supabaseClient';

/**
 * Normaliza relacionamentos/Foreign Keys retornados pelo PostgREST.
 * Se item.matches ou item.users vierem como Array [{...}], extrai o primeiro elemento.
 */
export function normalizePostgrestRelation(relation) {
  if (Array.isArray(relation)) {
    return relation.length > 0 ? relation[0] : null;
  }
  return relation ?? null;
}

export function normalizePrediction(item) {
  if (!item) return item;
  return {
    ...item,
    matches: normalizePostgrestRelation(item.matches),
    users: normalizePostgrestRelation(item.users),
  };
}

export async function getPredictions(userId, userLeagueId, matchIds) {
  if (!matchIds || matchIds.length === 0) return [];

  const numericUserId = Number(userId);
  const numericLeagueId = Number(userLeagueId);
  const numericMatchIds = matchIds.map((id) => Number(id));

  const { data, error } = await supabase
    .from('predictions')
    .select('match_id, prediction_home, prediction_away, points_earned')
    .eq('user_id', numericUserId)
    .eq('user_league_id', numericLeagueId)
    .in('match_id', numericMatchIds);

  if (error) throw error;
  return (data || []).map((pred) => ({
    ...pred,
    match_id: Number(pred.match_id),
  }));
}

export async function savePredictions(predictions) {
  if (!predictions || predictions.length === 0) return [];

  const payload = predictions.map((item) => ({
    user_id: Number(item.userId ?? item.user_id),
    user_league_id: Number(item.userLeagueId ?? item.user_league_id),
    match_id: Number(item.matchId ?? item.match_id),
    prediction_home: Number(item.predictionHome ?? item.prediction_home ?? 0),
    prediction_away: Number(item.predictionAway ?? item.prediction_away ?? 0),
    points_earned: 0,
  }));

  const { data, error } = await supabase
    .from('predictions')
    .upsert(payload, { onConflict: 'user_id,match_id,user_league_id' })
    .select();

  if (error) throw error;
  return data || [];
}

export async function savePrediction(prediction) {
  const savedList = await savePredictions([prediction]);
  return savedList?.[0] ?? null;
}

export async function getLeaguePredictions(userLeagueId, matchIds) {
  if (!matchIds || matchIds.length === 0) return [];

  const numericLeagueId = Number(userLeagueId);
  const numericMatchIds = matchIds.map((id) => Number(id));

  const { data, error } = await supabase
    .from('predictions')
    .select('prediction_home, prediction_away, points_earned, matches(id), users(id, name)')
    .eq('user_league_id', numericLeagueId)
    .in('match_id', numericMatchIds);

  if (error) throw error;
  return (data || []).map(normalizePrediction);
}

export async function getPredictionDetails(userId, matchIds) {
  if (!matchIds || matchIds.length === 0) return [];

  const numericUserId = Number(userId);
  const numericMatchIds = matchIds.map((id) => Number(id));

  const { data, error } = await supabase
    .from('predictions')
    .select('prediction_home, prediction_away, points_earned, matches(*, home_team:teams!matches_home_team_id_fkey(id, name, url_logo), away_team:teams!matches_away_team_id_fkey(id, name, url_logo))')
    .eq('user_id', numericUserId)
    .in('match_id', numericMatchIds);

  if (error) throw error;
  return (data || []).map(normalizePrediction);
}
