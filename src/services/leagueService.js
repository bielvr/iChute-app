import { supabase } from '../supabaseClient';

export async function getUserLeague(userLeagueId) {
  const { data, error } = await supabase
    .from('user_leagues')
    .select('*')
    .eq('id', userLeagueId)
    .single();
  if (error) throw error;
  return data;
}

export async function getUserLeagueDetails(userLeagueId) {
  const { data, error } = await supabase
    .from('user_leagues')
    .select('id, name, owner_id, official_league_id, leagues(sport_id)')
    .eq('id', userLeagueId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    officialLeagueId: data.official_league_id,
    sportId: data.leagues?.sport_id,
  };
}

export async function getLeagueComparisonContext(userLeagueId) {
  const [{ data: league, error: leagueError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from('user_leagues')
        .select(`
          id, 
          official_league_id, 
          leagues:official_league_id(sport_id), 
          leagues_config:config_id(exact_score_points, winner_and_one_goal_points, winner_only_points)
        `)
        .eq('id', userLeagueId)
        .single(),
      supabase
        .from('user_league_members')
        .select('user_id, users(name)')
        .eq('user_league_id', userLeagueId),
    ]);

  if (leagueError) throw leagueError;
  if (membersError) throw membersError;

  return {
    id: league.id,
    officialLeagueId: league.official_league_id,
    sportId: league.leagues?.sport_id,
    members: members.map((member) => ({
      id: member.user_id,
      name: member.users?.name ?? 'User',
    })),
    points: {
      exact: league.leagues_config?.exact_score_points ?? 3,
      winnerAndOneGoal: league.leagues_config?.winner_and_one_goal_points ?? 2,
      winnerOnly: league.leagues_config?.winner_only_points ?? 1,
    },
  };
}

export async function getLeagueSettingsData(userLeagueId, userId) {
  const [{ data: league, error: leagueError }, { data: membership, error: membershipError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from('user_leagues')
        .select('id, name, owner_id, official_league_id, leagues(sport_id), leagues_config(exact_score_points, winner_and_one_goal_points, winner_only_points)')
        .eq('id', userLeagueId)
        .single(),
      supabase
        .from('user_league_members')
        .select('id, role')
        .eq('user_league_id', userLeagueId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_league_members')
        .select('id, user_id, role, users(name, email)')
        .eq('user_league_id', userLeagueId),
    ]);

  if (leagueError) throw leagueError;
  if (membershipError) throw membershipError;
  if (membersError) throw membersError;

  const isOwner = league.owner_id === userId;
  const isAdmin = isOwner || membership?.role?.toLowerCase() === 'admin';

  return {
    id: league.id,
    name: league.name,
    sportId: league.leagues?.sport_id,
    isAdmin,
    membershipId: membership?.id ?? null,
    members,
    points: {
      exact: league.leagues_config?.exact_score_points ?? 3,
      winnerOne: league.leagues_config?.winner_and_one_goal_points ?? 2,
      winnerOnly: league.leagues_config?.winner_only_points ?? 1,
    },
  };
}

export async function saveLeagueScoring(userLeagueId, points) {
  const { data: config, error: configError } = await supabase
    .from('leagues_config')
    .insert({
      exact_score_points: Number(points.exact),
      winner_and_one_goal_points: Number(points.winnerOne),
      winner_only_points: Number(points.winnerOnly),
    })
    .select()
    .single();

  if (configError) throw configError;

  const { error } = await supabase
    .from('user_leagues')
    .update({ config_id: config.id })
    .eq('id', userLeagueId);

  if (error) throw error;
  return config;
}

export async function removeLeagueMember(memberId) {
  const { error } = await supabase.from('user_league_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function leaveLeague(membershipId) {
  const { error } = await supabase.from('user_league_members').delete().eq('id', membershipId);
  if (error) throw error;
}

export async function deleteLeague(userLeagueId) {
  const { error } = await supabase.from('user_leagues').delete().eq('id', userLeagueId);
  if (error) throw error;
}

export async function getLeagueMembers(userLeagueId) {
  const { data, error } = await supabase
    .from('user_league_members')
    .select('role, joined_at, users(id, name, email)')
    .eq('user_league_id', userLeagueId);

  if (error) throw error;
  return data.map((member) => ({ ...member.users, role: member.role, joinedAt: member.joined_at }));
}

export async function getLeagueOwner(userLeagueId) {
  const league = await getUserLeague(userLeagueId);
  const { data, error } = await supabase.from('users').select('*').eq('id', league.owner_id).single();
  if (error) throw error;
  return data;
}

export function isLeagueOwner(league, user) {
  return Boolean(league && user && league.owner_id === user.id);
}

// CORREÇÃO CENTRAL AQUI:
export async function getLigasPageData(userId, sportId) {
  const [{ data: sportData }, { data: participacoes, error: partError }, { data: reais, error: reaisError }] =
    await Promise.all([
      // 1. Busca nome do esporte
      supabase.from('sports').select('name').eq('id', sportId).single(),

      // 2. CORRIGIDO: usa user_league_id (e não league_id)
      supabase
        .from('user_league_members')
        .select(`
          user_league_id,
          user_leagues:user_league_id (
            id, 
            name, 
            official_league_id,
            leagues:official_league_id (
              sport_id
            )
          )
        `)
        .eq('user_id', userId),

      // 3. Ligas oficiais disponíveis para o esporte
      supabase.from('leagues').select('id, name').eq('sport_id', sportId).eq('show', true),
    ]);

  if (partError) throw partError;
  if (reaisError) throw reaisError;

  // Mapeia extraindo o objeto user_leagues e filtra pelo esporte correto
  const ligasAtivas = (participacoes || [])
    .map((p) => p.user_leagues)
    .filter((ul) => {
      if (!ul) return false;
      const official = Array.isArray(ul.leagues) ? ul.leagues[0] : ul.leagues;
      return Number(official?.sport_id) === Number(sportId);
    });

  return {
    sportName: sportData?.name || '',
    ligasAtivas,
    ligasReaisDisponiveis: reais || [],
  };
}
export async function joinLeagueByCode(userId, inviteCode) {
  const { data: league, error } = await supabase
    .from('user_leagues')
    .select('id, name')
    .eq('id', inviteCode)
    .single();

  if (error || !league) throw new Error('leagueNotFound');

  const { error: insertError } = await supabase
    .from('user_league_members')
    .insert({ user_league_id: league.id, user_id: userId, role: 'member' });

  if (insertError) throw insertError;

  return league;
}

export async function createPrivateLeague(userId, { name, officialLeagueId, points }) {
  const { data: config, error: configError } = await supabase
    .from('leagues_config')
    .insert({
      exact_score_points: Number(points.exact),
      winner_and_one_goal_points: Number(points.winnerOne),
      winner_only_points: Number(points.winnerOnly),
    })
    .select()
    .single();

  if (configError) throw configError;

  const { data: league, error: leagueError } = await supabase
    .from('user_leagues')
    .insert({
      name,
      owner_id: userId,
      config_id: config.id,
      official_league_id: officialLeagueId,
    })
    .select()
    .single();

  if (leagueError) throw leagueError;

  const { error: memberError } = await supabase
    .from('user_league_members')
    .insert({
      user_league_id: league.id,
      user_id: userId,
      role: 'admin',
    });

  if (memberError) throw memberError;

  return league;
}