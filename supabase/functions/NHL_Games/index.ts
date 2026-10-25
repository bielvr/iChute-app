const S_URL = Deno.env.get("SUPABASE_URL") ?? "";
const S_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  try {
    // 1. Busca os times da NHL
    const teamsRes = await fetch(`${S_URL}/rest/v1/teams?select=id,api_id`, {
      headers: { "apikey": S_KEY, "Authorization": `Bearer ${S_KEY}` }
    });
    const teams = await teamsRes.json();
    if (!Array.isArray(teams)) throw new Error("Erro ao carregar times da NHL");
    
    const teamMap = Object.fromEntries(
      teams.map((t: any) => [String(t.api_id).trim().toUpperCase(), t.id])
    );

    // 2. LÓGICA DE DATAS (Ontem até +14 dias)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const startDate = yesterday.toISOString().split('T')[0];
    
    const futureLimit = new Date(today);
    futureLimit.setDate(today.getDate() + 14);
    const endDateLimit = futureLimit.toISOString().split('T')[0];

    // Data da 2ª semana (dia inicial + 7 dias)
    const nextWeekDate = new Date(yesterday);
    nextWeekDate.setDate(yesterday.getDate() + 7);
    const startDateWeek2 = nextWeekDate.toISOString().split('T')[0];

    // Faz o fetch das 2 semanas em paralelo para cobrir os 14 dias
    const [res1, res2] = await Promise.all([
      fetch(`https://api-web.nhle.com/v1/schedule/${startDate}`),
      fetch(`https://api-web.nhle.com/v1/schedule/${startDateWeek2}`)
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    const allGameWeeks = [
      ...(data1.gameWeek || []),
      ...(data2.gameWeek || [])
    ];

    const gamesToInsert: any[] = [];

    allGameWeeks.forEach((day: any) => {
      // Filtro de segurança mantido em 14 dias
      if (day.date > endDateLimit) return;

      day.games?.forEach((game: any) => {
        // Ignora pré-temporada (1) e All-Star (4)
        if (game.gameType !== 2 && game.gameType !== 3) {
          return;
        }

        const hSigla = game.homeTeam.abbrev;
        const aSigla = game.awayTeam.abbrev;
        
        const hId = teamMap[hSigla];
        const aId = teamMap[aSigla];

        if (hId && aId) {
          gamesToInsert.push({
            api_id: `NHL_${game.id}`,
            league_id: 14, 
            home_team_id: hId,
            away_team_id: aId,
            season: String(game.season),
            date: game.startTimeUTC,
            status: game.gameState.toLowerCase(), // 'pre', 'live', 'final', 'off'
            goals_home: game.homeTeam.score ?? 0,
            goals_away: game.awayTeam.score ?? 0
          });
        }
      });
    });

    if (gamesToInsert.length === 0) {
      return new Response(JSON.stringify({ mensagem: "Nenhum jogo encontrado para o período." }), { status: 200 });
    }

    // 3. Upsert no Supabase
    const upsertRes = await fetch(`${S_URL}/rest/v1/matches?on_conflict=api_id`, {
      method: "POST",
      headers: {
        "apikey": S_KEY,
        "Authorization": `Bearer ${S_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(gamesToInsert)
    });

    if (!upsertRes.ok) {
      const errorDetail = await upsertRes.text();
      throw new Error(`Erro no banco: ${errorDetail}`);
    }

    return new Response(JSON.stringify({
      sucesso: true,
      data_inicio_consulta: startDate,
      jogos_processados: gamesToInsert.length,
      status: "Sincronização realizada com sucesso"
    }, null, 2), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ erro: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});