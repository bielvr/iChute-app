import { supabase } from '../supabaseClient';

export async function getPredictions(userId, userLeagueId, matchIds) {
  if (!matchIds.length) return [];
  const { data, error } = await supabase.from('predictions').select('match_id, prediction_home, prediction_away, points_earned').eq('user_id', userId).eq('user_league_id', userLeagueId).in('match_id', matchIds);
  if (error) throw error;
  return data;
}

export async function savePredictions(predictions) {
  const payload = predictions.map(({ userId, userLeagueId, matchId, predictionHome, predictionAway }) => ({ user_id: userId, user_league_id: userLeagueId, match_id: matchId, prediction_home: predictionHome, prediction_away: predictionAway, points_earned: 0 }));
  const { data, error } = await supabase.from('predictions').upsert(payload, { onConflict: 'user_id,match_id,user_league_id' }).select();
  if (error) throw error;
  return data;
}

export async function savePrediction(prediction) { const [saved] = await savePredictions([prediction]); return saved; }

export async function getLeaguePredictions(userLeagueId, matchIds) { const { data, error } = await supabase.from('predictions').select('prediction_home, prediction_away, points_earned, matches(id), users(id, name)').eq('user_league_id', userLeagueId).in('match_id', matchIds); if (error) throw error; return data; }
export async function getPredictionDetails(userId, matchIds) { const { data, error } = await supabase.from('predictions').select('prediction_home, prediction_away, points_earned, matches(*, home_team:teams!matches_home_team_id_fkey(id, name, url_logo), away_team:teams!matches_away_team_id_fkey(id, name, url_logo))').eq('user_id', userId).in('match_id', matchIds); if (error) throw error; return data; }
