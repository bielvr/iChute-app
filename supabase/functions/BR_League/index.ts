const S_URL = Deno.env.get("SUPABASE_URL") ?? "";
const S_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FD_KEY = "b715b9bf74114e74b66e8c6b3cb78b32";

Deno.serve(async (req) => {
  try {
    // 1. Busca os times do seu banco para o mapeamento
    const teamsRes = await fetch(`${S_URL}/rest/v1/teams?select=id,api_id`, {
      headers: { 
        "apikey": S_KEY, 
        "Authorization": `Bearer ${S_KEY}` 
      }
    });
    
    const teams = await teamsRes.json();
    if (!Array.isArray(teams)) {
      return new Response(JSON.stringify({ erro: "Erro ao ler times", detalhes: teams }), { status: 400 });
    }
    
    const teamMap = Object.fromEntries(
      teams.map((t: any) => [String(t.api_id).trim(), t.id])
    );

    // 2. Busca jogos do Brasileirão (BSA) no Football-Data.org
    const apiRes = await fetch("https://api.football-data.org/v4/competitions/BSA/matches?season=2026", {
      headers: { "X-Auth-Token": FD_KEY }
    });
    
    const apiData = await apiRes.json();
    const matchesApi = apiData.matches || [];

    // 3. Formata os dados para o Supabase
    const payload = matchesApi.map((m: any) => {
      const hId = teamMap[String(m.homeTeam.id)];
      const aId = teamMap[String(m.awayTeam.id)];

      if (!hId || !aId) return null;

      return {
        api_id: `FD_${m.id}`, 
        league_id: 1, // ID do Brasileirão no iChute
        round: m.matchday, 
        home_team_id: hId,
        away_team_id: aId,
        season: "2026",
        date: m.utcDate,
        status: m.status.toLowerCase(),
        goals_home: m.score?.fullTime?.home ?? null,
        goals_away: m.score?.fullTime?.away ?? null
      };
    }).filter((m: any) => m !== null);

    // 4. Upsert (Sincronização com tratamento de conflito)
    const upsertRes = await fetch(`${S_URL}/rest/v1/matches?on_conflict=api_id`, {
      method: "POST",
      headers: {
        "apikey": S_KEY,
        "Authorization": `Bearer ${S_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" 
      },
      body: JSON.stringify(payload)
    });

    if (!upsertRes.ok) {
      const errorDetail = await upsertRes.text();
      return new Response(JSON.stringify({ erro: "Erro no Upsert", detalhes: errorDetail }), { status: 400 });
    }

    return new Response(JSON.stringify({
      sucesso: true,
      total_jogos_sincronizados: payload.length,
      mensagem: "iChute atualizado com os jogos do Brasileirão!"
    }, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: "Erro Fatal", mensagem: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});