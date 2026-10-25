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

  try {
    // ==========================================
    // 1. FUNÇÕES DE FUTEBOL
    // ==========================================
    console.log("Chamando BR_League...");
    await fetch(`${regionUrl}/BR_League`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando Bundesliga_Games...");
    await fetch(`${regionUrl}/Bundesliga_Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando SerieA_Games...");
    await fetch(`${regionUrl}/SerieA_Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando LaLiga_Games...");
    await fetch(`${regionUrl}/LaLiga_Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando PL_Games...");
    await fetch(`${regionUrl}/PL_Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando World_Cup...");
    await fetch(`${regionUrl}/World_Cup`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

        console.log("Chamando UCL-Games...");
    await fetch(`${regionUrl}/UCL-Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    // ==========================================
    // 2. FUNÇÃO DA NHL
    // ==========================================
    console.log("Chamando NHL_Games...");
    await fetch(`${regionUrl}/NHL_Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    // ==========================================
    // 3. NOVAS FUNÇÕES: ESPORTES AMERICANOS (BDL)
    // ==========================================
    console.log("Chamando NBA-Games...");
    await fetch(`${regionUrl}/NBA-Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando MLB-Games...");
    await fetch(`${regionUrl}/MLB-Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    console.log("Chamando NFL-Games...");
    await fetch(`${regionUrl}/NFL-Games`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}` }
    });

    // ==========================================
    // 4. VERIFICAÇÃO DE RESULTADOS LEGACY (OPCIONAL)
    // ==========================================
    const { data: matches } = await supabase
      .from('matches')
      .select('id, external_id, sport_id, start_at')
      .neq('status', 'finished')
      .lt('start_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

    for (const match of matches || []) {
      // Sua lógica atual permanece intocada aqui...
    }

    return new Response(JSON.stringify({ 
      message: "Maestro executado com sucesso: Todas as ligas (Futebol, NHL, NBA, MLB e NFL) foram disparadas!" 
    }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})