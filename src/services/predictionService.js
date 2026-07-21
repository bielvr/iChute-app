import { supabase } from "../supabaseClient";

export async function getPredictions(userId, matchIds) {

    const { data, error } = await supabase
        .from("predictions")
        .select(`
            match_id,
            prediction_home,
            prediction_away,
            points_earned
        `)
        .eq("user_id", userId)
        .in("match_id", matchIds);

    if (error) {
        throw error;
    }

    return data;

}

export async function getLeaguePredictions(userLeagueId, matchIds) {

    const { data, error } = await supabase
        .from("predictions")
        .select(`
            prediction_home,
            prediction_away,
            points_earned,
            matches (
                id
            ),
            users (
                id,
                name
            )
        `)
        .eq("user_league_id", userLeagueId)
        .in("match_id", matchIds);

    if (error) {
        throw error;
    }

    return data;

}

export async function savePrediction({
    userId,
    userLeagueId,
    matchId,
    predictionHome,
    predictionAway
}) {

    const { data, error } = await supabase
        .from("predictions")
        .upsert({
            user_id: userId,
            user_league_id: userLeagueId,
            match_id: matchId,
            prediction_home: predictionHome,
            prediction_away: predictionAway
        }, {
            onConflict: "user_id,match_id"
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}

export async function getPredictionDetails(userId, matchIds) {

    const { data, error } = await supabase
        .from("predictions")
        .select(`
            prediction_home,
            prediction_away,
            points_earned,
            matches (
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
            )
        `)
        .eq("user_id", userId)
        .in("match_id", matchIds);

    if (error) {
        throw error;
    }

    return data;

}