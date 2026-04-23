import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ggdegoklijzwbjrbsguz.supabase.co'
const supabaseAnonKey = 'sb_publishable_HwPlPnq0Wp0wocMSoaQqbQ_GF9oqbNJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)