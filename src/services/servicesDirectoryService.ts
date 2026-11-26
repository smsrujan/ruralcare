import { requireSupabase } from '../lib/supabaseClient';
import { logSupabaseError, mapServiceRow } from '../utils/supabaseMappers';
import type { HealthcareService } from '../types/ruralcare';

export async function fetchHealthcareServicesFromSupabase(): Promise<HealthcareService[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('healthcare_services')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(logSupabaseError('Load healthcare_services', error, 'healthcare_services'));
  }

  return (data ?? []).map(mapServiceRow);
}
