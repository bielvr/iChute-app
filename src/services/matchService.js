import { supabase } from "../supabaseClient";

export async function getMatches({
    leagueId,
    season,
    round,
    date
}) {

    let query = supabase
        .from("matches")
        .select(`
            *,
            home_team:teams!matches_home_team_id_fkey (
                id,
                name,
                url_logo
            ),
            away_team:teams!matches_away_team_id_fkey (
                id,
                name,
                url_logo
            )
        `)
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("date");

    if (round !== undefined && round !== null) {
        query = query.eq("round", round);
    }

    if (date !== undefined && date !== null) {
    query = query.eq("date", date);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
}

export async function getLatestSeason(leagueId) {

    const { data, error } = await supabase
        .from("matches")
        .select("season")
        .eq("league_id", leagueId)
        .order("season", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        throw error;
    }

    return data.season;
}

export async function getAvailableSeasons(leagueId) {

    const { data, error } = await supabase
        .from("matches")
        .select("season")
        .eq("league_id", leagueId)
        .order("season", { ascending: false });

    if (error) {
        throw error;
    }

    return [...new Set(data.map(match => match.season))];
}

export async function getLeagueTeams(leagueId, season) {

    const { data, error } = await supabase
        .from("league_members")
        .select(`
            teams (
                id,
                name,
                url_logo
            )
        `)
        .eq("league_id", leagueId)
        .eq("season", season);

    if (error) {
        throw error;
    }

    return data.map(team => team.teams);
}

export async function getRounds(leagueId, season) {

    const { data, error } = await supabase
        .from("matches")
        .select("round")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("round");

    if (error) {
        throw error;
    }

    return [...new Set(data.map(match => match.round))];
}

export async function getMatchDates(leagueId, season) {

    const { data, error } = await supabase
        .from("matches")
        .select("date")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("date");

    if (error) {
        throw error;
    }

    return [...new Set(data.map(match => match.date))];
}
