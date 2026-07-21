import { supabase } from '../supabaseClient';

export async function getWhatIfScenario({ userId, userLeagueId, officialLeagueId }) {
  const [{ data: stats, error: statsError }, { data: teams, error: teamsError }, { data: matches, error: matchesError }] = await Promise.all([
    supabase.from('user_team_what_if_stats').select('*').eq('user_id', userId).eq('user_league_id', userLeagueId),
    supabase.from('teams').select('id, name, url_logo'),
    supabase.from('matches').select('home_team_id, away_team_id').eq('league_id', officialLeagueId),
  ]);
  if (statsError) throw statsError; if (teamsError) throw teamsError; if (matchesError) throw matchesError;
  return { stats, teams, matches };
}
