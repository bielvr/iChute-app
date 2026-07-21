export async function getRanking(userLeagueId) {

    const { data, error } = await supabase
        .from("ranking")
        .select("*")
        .eq("user_league_id", userLeagueId);

    if (error) {
        throw error;
    }

    return data;

}