import { supabase } from "../supabaseClient";

export async function getUserLeague(userLeagueId) {

    const { data, error } = await supabase
        .from("user_leagues")
        .select("*")
        .eq("id", userLeagueId)
        .single();

    if (error) {
        throw error;
    }
    return data;
}

export async function getLeagueMembers(userLeagueId) {

    const { data, error } = await supabase
        .from("user_league_members")
        .select(`
            role,
            joined_at,
            users (
                id,
                name,
                email
            )
        `)
        .eq("user_league_id", userLeagueId);
    if (error) {
        throw error;
    }
    return data.map(member => ({
        ...member.users,
        role: member.role,
        joinedAt: member.joined_at
    }));
}

export async function getLeagueOwner(userLeagueId) {

    const league = await getLeague(userLeagueId);
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", league.owner_id)
        .single();
    if (error) {
        throw error;
    }
    return data;
}

export function isLeagueOwner(league, user) {

    if (!league || !user) {
        return false;
    }
    return league.owner_id === user.id;

}