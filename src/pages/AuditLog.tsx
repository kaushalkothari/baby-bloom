import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useSupabaseAuth } from '@/lib/supabase/useSupabaseAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  fetchAuditLogs,
  writeAuditLog,
  type AuditLogRow,
  type AuditAction,
  type AuditEntityType,
} from '@/lib/audit/auditLogger';
import { toast } from 'sonner';

const ACTION_LABELS: Record<string, string> = {
  sign_in: 'Sign In',
  sign_up: 'Sign Up',
  sign_out: 'Sign Out',
  password_reset_request: 'Password Reset',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  export_data: 'Data Export',
  import_data: 'Data Import',
  view: 'View',
  upload: 'Upload',
  download: 'Download',
};

const ENTITY_LABELS: Record<string, string> = {
  child: 'Child',
  hospital_visit: 'Hospital Visit',
  vaccination: 'Vaccination',
  prescription: 'Prescription',
  document: 'Document',
  billing_record: 'Billing Record',
  profile: 'Profile',
};

function actionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'delete':
      return 'destructive';
    case 'create':
    case 'sign_up':
      return 'default';
    case 'update':
    case 'upload':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) return '';
  const parts: string[] = [];
  if (metadata.name) parts.push(`Name: ${metadata.name}`);
  if (metadata.hospitalName) parts.push(`Hospital: ${metadata.hospitalName}`);
  if (metadata.vaccineName) parts.push(`Vaccine: ${metadata.vaccineName}`);
  if (metadata.prescribingDoctor) parts.push(`Doctor: ${metadata.prescribingDoctor}`);
  if (metadata.reason) parts.push(`Reason: ${metadata.reason}`);
  if (metadata.amount) parts.push(`Amount: ₹${metadata.amount}`);
  if (metadata.documentType) parts.push(`Type: ${metadata.documentType}`);
  if (metadata.method) parts.push(`Method: ${metadata.method}`);
  if (metadata.medicineCount != null) parts.push(`Medicines: ${metadata.medicineCount}`);
  if (metadata.childrenCount != null) parts.push(`${metadata.childrenCount} children exported`);
  if (metadata.source) parts.push(`Source: ${metadata.source}`);
  return parts.join(' · ');
}

const PAGE_SIZE = 25;

export default function AuditLog() {
  const { user } = useSupabaseAuth();
  const userId = user?.id ?? null;
  const client = useMemo(() => getSupabaseBrowserClient(), []);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [testingWrite, setTestingWrite] = useState(false);

  const load = useCallback(async () => {
    if (!client || !userId) return;
    setLoading(true);
    try {
      const opts: { limit: number; offset: number; action?: AuditAction; entityType?: AuditEntityType } = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (actionFilter !== 'all') opts.action = actionFilter as AuditAction;
      if (entityFilter !== 'all') opts.entityType = entityFilter as AuditEntityType;
      const result = await fetchAuditLogs(client, userId, opts);
      setLogs(result.data);
      setTotalCount(result.count);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const missingTable =
        /audit_logs|schema cache|Could not find the table|does not exist|PGRST205/i.test(raw);
      toast.error(
        missingTable
          ? 'Audit table or RPC missing. Run both migrations in supabase/migrations/: 20260510160000_audit_logs.sql and 20260511120000_audit_log_rpc.sql (e.g. supabase db push or SQL Editor).'
          : raw,
      );
    } finally {
      setLoading(false);
    }
  }, [client, userId, page, actionFilter, entityFilter]);

  const runTestWrite = useCallback(async () => {
    if (!client || !userId) return;
    setTestingWrite(true);
    try {
      const ok = await writeAuditLog(client, userId, {
        action: 'view',
        metadata: { source: 'audit_page_probe' },
      });
      if (ok) {
        toast.success('Test audit entry saved. List refreshed.');
        await load();
      } else {
        toast.error('Could not write audit row. Check the browser console for lines starting with [audit].');
      }
    } finally {
      setTestingWrite(false);
    }
  }, [client, userId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Review all actions performed on your account and health records
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Activity History</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[150px] h-9 text-xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="sign_in">Sign In</SelectItem>
                  <SelectItem value="sign_up">Sign Up</SelectItem>
                  <SelectItem value="sign_out">Sign Out</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="export_data">Data Export</SelectItem>
                  <SelectItem value="password_reset_request">Password Reset</SelectItem>
                </SelectContent>
              </Select>

              <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="hospital_visit">Hospital Visit</SelectItem>
                  <SelectItem value="vaccination">Vaccination</SelectItem>
                  <SelectItem value="prescription">Prescription</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="billing_record">Billing Record</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={loading || testingWrite || !userId}
                className="h-9"
                onClick={() => void runTestWrite()}
              >
                {testingWrite ? 'Writing…' : 'Test write'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No audit logs found</p>
              <p className="text-xs mt-1 max-w-md mx-auto text-muted-foreground">
                Use <strong>Test write</strong> above to verify the database and RLS. If it fails, apply all
                <code className="text-[10px] bg-muted px-1 rounded mx-0.5">audit_logs</code> migrations
                (<code className="text-[10px] bg-muted px-0.5">supabase db push</code>) and check the console for{' '}
                <code className="text-[10px] bg-muted px-1 rounded">[audit]</code>.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                type="button"
                disabled={testingWrite || !userId}
                onClick={() => void runTestWrite()}
              >
                {testingWrite ? 'Writing…' : 'Test write'}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2 shrink-0 min-w-[170px]">
                      <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={actionBadgeVariant(log.action)} className="text-[10px] px-2 py-0.5">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      {log.entity_type && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                          {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground truncate block">
                        {formatMetadata(log.metadata as Record<string, unknown> | null)}
                      </span>
                    </div>

                    {log.entity_id && (
                      <span
                        className="text-[10px] text-muted-foreground/60 font-mono shrink-0 hidden lg:block"
                        title={log.entity_id}
                      >
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  {totalCount} total {totalCount === 1 ? 'entry' : 'entries'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
