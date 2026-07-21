import { supabase } from "../supabaseClient";
export async function getCurrentAuthUser() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }
    return user;
}

export async function getCurrentUser() {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
        return null;
    }
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", authUser.email)
        .single();
    if (error) {
        throw error;
    }
    return {
    id: data.id,
    email: data.email,
    username: data.username,
    };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw error;
    }
}