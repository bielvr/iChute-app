import { supabase } from '../supabaseClient';

const throwIfError = ({ data, error }) => { if (error) throw error; return data; };

export async function getMatches({ leagueId, season, round, date }) {
  let query = supabase.from('matches').select('*, home_team:teams!matches_home_team_id_fkey(id, name, url_logo), away_team:teams!matches_away_team_id_fkey(id, name, url_logo)').eq('league_id', leagueId).eq('season', season).order('date');
  if (round !== undefined && round !== null) query = query.eq('round', round);
  if (date) { const base = new Date(`${date}T12:00:00`); query = query.gte('date', new Date(base.getTime() - 86400000).toISOString()).lte('date', new Date(base.getTime() + 86400000).toISOString()); }
  const matches = throwIfError(await query);
  return date ? matches.filter((match) => new Date(match.date).toLocaleDateString('en-CA') === date) : matches;
}

export async function getLatestSeason(leagueId) { const data = throwIfError(await supabase.from('matches').select('season').eq('league_id', leagueId).order('season', { ascending: false }).limit(1).single()); return data.season; }
export async function getAvailableSeasons(leagueId) { const data = throwIfError(await supabase.from('matches').select('season').eq('league_id', leagueId).order('season', { ascending: false })); return [...new Set(data.map((match) => match.season))]; }
export async function getLeagueTeams(leagueId, season) { const data = throwIfError(await supabase.from('league_members').select('teams(id, name, url_logo)').eq('league_id', leagueId).eq('season', season)); return data.map((item) => item.teams); }
export async function getRounds(leagueId, season) { const data = throwIfError(await supabase.from('matches').select('round').eq('league_id', leagueId).eq('season', season).order('round')); return [...new Set(data.map((match) => match.round).filter(Boolean))]; }
export async function getMatchDates(leagueId, season) { const data = throwIfError(await supabase.from('matches').select('date').eq('league_id', leagueId).eq('season', season).order('date')); return [...new Set(data.map((match) => match.date))]; }
export async function getMatchCountsByDay({ leagueId, season, round }) { let query = supabase.from('matches').select('date').eq('league_id', leagueId).eq('season', season); if (round) query = query.eq('round', round); return throwIfError(await query); }
export async function getNearestMatch({ leagueId, season, direction }) { let query = supabase.from('matches').select('round, date').eq('league_id', leagueId).eq('season', season).order('date', { ascending: direction === 'next' }).limit(1); query = direction === 'next' ? query.gte('date', new Date().toISOString()) : query.lt('date', new Date().toISOString()); const { data, error } = await query.maybeSingle(); if (error) throw error; return data; }
export async function getFirstMatchByRound(leagueId, season, round) { const { data, error } = await supabase.from('matches').select('date').eq('league_id', leagueId).eq('season', season).eq('round', round).order('date').limit(1).maybeSingle(); if (error) throw error; return data; }
