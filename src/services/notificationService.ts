import { requireSupabase } from '../lib/supabaseClient';
import { logSupabaseError, mapNotificationRow } from '../utils/supabaseMappers';
import type { NotificationItem } from '../types/ruralcare';

export async function fetchUserNotificationsFromSupabase(
  userId: string
): Promise<NotificationItem[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(logSupabaseError('Load notifications', error, 'notifications'));
  }
  return (data ?? []).map(mapNotificationRow);
}

export async function markNotificationReadInSupabase(notificationId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) {
    throw new Error(logSupabaseError('Update notifications', error, 'notifications'));
  }
}

export async function markAllNotificationsReadInSupabase(userId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) {
    throw new Error(logSupabaseError('Update notifications', error, 'notifications'));
  }
}
