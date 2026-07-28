import { supabase } from '../supabaseClient';

export async function getWhatIfScenario({ userId, userLeagueId, officialLeagueId }) {
  const [
    { data: stats, error: statsError }, 
    { data: teams, error: teamsError }, 
    { data: matches, error: matchesError },
    { data: predictions, error: predictionsError }
  ] = await Promise.all([
    supabase.from('user_team_what_if_stats').select('*').eq('user_id', userId).eq('user_league_id', userLeagueId),
    supabase.from('teams').select('id, name, url_logo'),
    supabase.from('matches').select('home_team_id, away_team_id').eq('league_id', officialLeagueId),
    supabase.from('predictions')
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
          home_team:teams!matches_home_team_id_fkey (id, name, url_logo),
          away_team:teams!matches_away_team_id_fkey (id, name, url_logo)
        )
      `)
      .eq('user_id', userId)
      .eq('user_league_id', userLeagueId)
  ]);

  if (statsError) throw statsError; 
  if (teamsError) throw teamsError; 
  if (matchesError) throw matchesError;
  if (predictionsError) throw predictionsError;

  return { stats, teams, matches, predictions };
}