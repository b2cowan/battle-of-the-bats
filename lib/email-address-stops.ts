import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * "No more email from FieldLogicHQ" for an ADDRESS (Club Website Track P, Session P4; /legal's Track P review finding 3;
 * owner 2026-11-26: every promotional send FieldLogicHQ makes honours it). Written only by the unsubscribe in the one
 * preview email (`email_address_stops`, mig 547), keyed to the address alone so it outlives the deleted preview.
 *
 * FAIL-CLOSED: a stop that cannot be read counts as stopped. Mailing someone who unsubscribed is the CASL harm; a missed
 * promotional email is not.
 */
export async function isAddressStopped(email: string): Promise<boolean> {
  const key = email.trim().toLowerCase();
  if (!key) return true;
  const { data, error } = await supabaseAdmin.from('email_address_stops').select('email').eq('email', key).maybeSingle();
  if (error) {
    console.error('[email-address-stops] the stop could not be read, so the email is not sent:', error.code, error.message);
    return true;
  }
  return Boolean(data);
}
