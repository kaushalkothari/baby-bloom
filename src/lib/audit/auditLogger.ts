import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

export type AuditAction =
  | 'sign_in'
  | 'sign_up'
  | 'sign_out'
  | 'password_reset_request'
  | 'create'
  | 'update'
  | 'delete'
  | 'export_data'
  | 'import_data'
  | 'view'
  | 'upload'
  | 'download';

export type AuditEntityType =
  | 'child'
  | 'hospital_visit'
  | 'vaccination'
  | 'prescription'
  | 'document'
  | 'billing_record'
  | 'profile';

export interface AuditEntry {
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

type Client = SupabaseClient<Database>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Avoid RPC/insert failures when a domain id is not a real UUID. */
function entityIdForDb(id: string | undefined): string | null {
  if (id == null || id === '') return null;
  const t = id.trim();
  if (!UUID_RE.test(t)) {
    console.warn('[audit] entity_id is not a UUID; omitting:', id);
    return null;
  }
  return t;
}

function getBrowserContext(): { userAgent: string | null } {
  if (typeof navigator !== 'undefined') {
    return { userAgent: navigator.userAgent ?? null };
  }
  return { userAgent: null };
}

/**
 * Write a single audit log entry. Tries RPC first (`user_id` = JWT user), then
 * direct insert so logging still works if RPC is missing, denied, or PostgREST
 * returns a non-matching error.
 *
 * @returns true if a row was written via either path
 */
export async function writeAuditLog(
  client: Client,
  userId: string,
  entry: AuditEntry,
): Promise<boolean> {
  try {
    const ctx = getBrowserContext();
    const meta = (entry.metadata ?? {}) as Json;
    const entityId = entityIdForDb(entry.entityId);

    const { error: rpcError } = await client.rpc('log_audit_event', {
      p_action: entry.action,
      p_entity_type: entry.entityType ?? null,
      p_entity_id: entityId,
      p_metadata: meta,
      p_user_agent: ctx.userAgent,
    });
    if (!rpcError) return true;

    console.warn('[audit] log_audit_event failed, trying direct insert:', rpcError.message, rpcError);

    const { error: insertError } = await client.from('audit_logs').insert({
      user_id: userId,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entityId,
      metadata: meta,
      user_agent: ctx.userAgent,
    });
    if (!insertError) return true;

    console.warn('[audit] Direct insert also failed:', insertError.message, { rpcError, insertError });
    return false;
  } catch (err) {
    console.warn('[audit] Failed to write audit log:', err);
    return false;
  }
}

/**
 * Write multiple audit entries in a single round-trip.
 */
export async function writeAuditLogBatch(
  client: Client,
  userId: string,
  entries: AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await Promise.all(entries.map((e) => writeAuditLog(client, userId, e)));
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Fetch paginated audit logs for the current user (newest first).
 */
export async function fetchAuditLogs(
  client: Client,
  userId: string,
  opts: { limit?: number; offset?: number; action?: AuditAction; entityType?: AuditEntityType } = {},
): Promise<{ data: AuditLogRow[]; count: number }> {
  const { limit = 50, offset = 0, action, entityType } = opts;

  let query = client
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) query = query.eq('action', action);
  if (entityType) query = query.eq('entity_type', entityType);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as AuditLogRow[], count: count ?? 0 };
}
