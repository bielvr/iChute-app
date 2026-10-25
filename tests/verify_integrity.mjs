import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ggdegoklijzwbjrbsguz.supabase.co';
const supabaseAnonKey = 'sb_publishable_HwPlPnq0Wp0wocMSoaQqbQ_GF9oqbNJ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyIntegrity() {
  await supabase.auth.signInWithPassword({
    email: 'bielvieirarocha@gmail.com',
    password: 'iChute'
  });

  // Checar palpites com placar 9 x 9
  const { data: testPreds } = await supabase
    .from('predictions')
    .select('id, user_id, user_league_id, match_id, prediction_home, prediction_away, created_at')
    .eq('prediction_home', 9)
    .eq('prediction_away', 9);

  console.log('Palpites com 9 x 9 encontrados no banco:', testPreds?.length);
  console.log('Detalhes dos palpites 9 x 9:', testPreds);

  // Checar se a partida do teste é futura
  if (testPreds && testPreds.length > 0) {
    for (const tp of testPreds) {
      const { data: match } = await supabase
        .from('matches')
        .select('id, date, status, home_team_id, away_team_id')
        .eq('id', tp.match_id)
        .single();
      console.log(`Partida do teste (ID ${tp.match_id}): Data=${match.date}, Status=${match.status}, É futura? ${new Date(match.date) > new Date()}`);
    }
  }

  // Checar total de palpites do Gabriel
  const { count: userPredsCount } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', 2);

  console.log('Total de palpites do usuário Gabriel:', userPredsCount);
}

verifyIntegrity().catch(console.error);
