import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const regionUrl = "https://ggdegoklijzwbjrbsguz.supabase.co/functions/v1";
  const SECRET_KEYS_JSON = Deno.env.get('SUPABASE_SECRET_KEYS') ?? "";

  // Extração segura da Service Role para os cabeçalhos de Fetch das Functions
  let serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";
  if (!serviceRoleKey && SECRET_KEYS_JSON) {
    try {
      const keys = JSON.parse(SECRET_KEYS_JSON);
      serviceRoleKey = keys.service_role_key || keys.service_key || Object.values(keys)[0];
    } catch {
      serviceRoleKey = SECRET_KEYS_JSON;
    }
  }

  const endpoints = [
    // Futebol
    "BR_League",
    "Bundesliga_Games",
    "SerieA_Games",
    "LaLiga_Games",
    "PL_Games",
    "World_Cup",
    "UCL-Games",
    // NHL
    "NHL_Games",
    // Esportes Americanos (BDL)
    "NBA-Games",
    "MLB-Games",
    "NFL-Games"
  ];

  try {
    const headers = { 
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    };

    console.log("Disparando todas as ligas em paralelo via Promise.allSettled...");

    const results = await Promise.allSettled(
      endpoints.map(async (fnName) => {
        const start = Date.now();
        try {
          const res = await fetch(`${regionUrl}/${fnName}`, {
            method: 'POST',
            headers
          });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          return {
            function: fnName,
            status: res.status,
            durationMs: Date.now() - start,
            response: data
          };
        } catch (error: any) {
          return {
            function: fnName,
            status: 500,
            durationMs: Date.now() - start,
            error: error.message
          };
        }
      })
    );

    const summary = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      }
      return {
        function: endpoints[i],
        status: 500,
        error: r.reason?.message ?? 'Unknown rejection'
      };
    });

    console.log("Resumo da execução paralela:", JSON.stringify(summary));

    return new Response(JSON.stringify({ 
      message: "Maestro executado com sucesso em paralelo via Promise.allSettled!",
      summary
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
