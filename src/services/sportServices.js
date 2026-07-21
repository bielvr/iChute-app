import { supabase } from '../supabaseClient';

export async function getVisibleSports() {
  const { data, error } = await supabase.from('sports').select('id, name').eq('show', true).order('name');
  if (error) throw error;
  return data;
}
