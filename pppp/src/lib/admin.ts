import { supabase } from './supabase';

export async function changeUserRole(userId: string, newRole: string, adminId?: string) {
  const { data, error } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction(adminId, 'change_role', { userId, newRole }).catch(() => {});
  return data;
}

export async function deleteUser(userId: string, adminId?: string) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;

  await logAdminAction(adminId, 'delete_user', { userId }).catch(() => {});
  return true;
}

export async function updateListingStatus(listingId: string, status: string, adminId?: string) {
  const { data, error } = await supabase
    .from('scrap_listings')
    .update({ status })
    .eq('scrap_id', listingId)
    .select()
    .single();

  if (error) throw error;
  await logAdminAction(adminId, 'update_listing_status', { listingId, status }).catch(() => {});
  return data;
}

export async function flagListing(listingId: string, reason: string, adminId?: string) {
  const { data, error } = await supabase
    .from('listing_flags')
    .insert({ scrap_id: listingId, reason, flagged_by: adminId || null, flagged_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  await logAdminAction(adminId, 'flag_listing', { listingId, reason }).catch(() => {});
  return data;
}

export async function updateTransactionStatus(transactionId: string, status: string, adminId?: string) {
  const { data, error } = await supabase
    .from('transactions')
    .update({ status })
    .eq('transaction_id', transactionId)
    .select()
    .single();

  if (error) throw error;
  await logAdminAction(adminId, 'update_transaction_status', { transactionId, status }).catch(() => {});
  return data;
}

export async function updatePickupRequestStatus(requestId: string, status: string, adminId?: string) {
  const { data, error } = await supabase
    .from('pickup_requests')
    .update({ pickup_status: status })
    .eq('request_id', requestId)
    .select()
    .single();

  if (error) throw error;
  await logAdminAction(adminId, 'update_pickup_status', { requestId, status }).catch(() => {});
  return data;
}

export async function flagPickupRequest(requestId: string, reason: string, adminId?: string) {
  const { data, error } = await supabase
    .from('pickup_flags')
    .insert({ request_id: requestId, reason, flagged_by: adminId || null, flagged_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  await logAdminAction(adminId, 'flag_pickup_request', { requestId, reason }).catch(() => {});
  return data;
}

export async function logAdminAction(adminId: string | undefined | null, actionType: string, details: any) {
  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminId || null,
      action_type: actionType,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // don't block main flow if audit logging fails
    console.warn('Failed to write audit log', err);
  }
}

export default {
  changeUserRole,
  deleteUser,
  logAdminAction,
};
