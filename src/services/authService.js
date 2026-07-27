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

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return data;
}

export async function updateUserPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw error;
    }
}

export async function getUserSettingsDetails(email) {
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, name, email, locale")
    .eq("email", email)
    .single();

  if (userError) throw userError;

  const [pushRes, emailRes] = await Promise.all([
    supabase
      .from("user_push_subscriptions")
      .select("lead_time_minutes")
      .eq("user_id", userData.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_email_subscriptions")
      .select("enabled, lead_time_minutes")
      .eq("user_id", userData.id)
      .maybeSingle(),
  ]);

  return {
    userData,
    pushLeadTime: pushRes.data?.lead_time_minutes ?? 15,
    emailSub: emailRes.data ?? { enabled: false, lead_time_minutes: 60 },
  };
}

export async function updateUserProfile(userId, { name, email, locale }) {
  const { error } = await supabase
    .from("users")
    .update({ name, email, locale })
    .eq("id", userId);

  if (error) throw error;
}

export async function savePushSubscription(userId, { endpoint, p256dh, auth, leadTime }) {
  const { error } = await supabase
    .from("user_push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        lead_time_minutes: parseInt(leadTime, 10),
      },
      { onConflict: "user_id, endpoint" }
    );

  if (error) throw error;
}

export async function saveEmailSubscription(userId, { email, enabled, leadTime }) {
  const { error } = await supabase
    .from("user_email_subscriptions")
    .upsert(
      {
        user_id: userId,
        email,
        enabled,
        lead_time_minutes: parseInt(leadTime, 10),
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}