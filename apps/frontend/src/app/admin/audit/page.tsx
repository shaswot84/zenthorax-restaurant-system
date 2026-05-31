'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';

export default function AuditLogsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
    if (search) params.set('search', search);
    const res = await apiGet<any>(`/api/admin/audit-logs?${params.toString()}`);
    if (res.success && res.data) { setLogs(res.data); setTotal(res.meta?.total ?? 0); }
  }, [search, page]);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading, search, page]);

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div className="w-full">
        <h1 className="text-xl sm:text-2xl font-bold">Audit Logs</h1>
        <p className="text-xs text-muted-foreground mt-1">{total} total entries</p>

        <div className="mt-3">
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by action or target..." className="w-full rounded-lg border px-3 py-2 text-sm" />
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-3 py-2 text-left font-medium">Time</th>
                <th className="px-2 sm:px-3 py-2 text-left font-medium">Actor</th>
                <th className="px-2 sm:px-3 py-2 text-left font-medium">Action</th>
                <th className="px-2 sm:px-3 py-2 text-left font-medium">Target</th>
                <th className="px-2 sm:px-3 py-2 text-left font-medium hidden sm:table-cell">Restaurant</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No audit logs found.</td></tr>
              ) : logs.map((l: any) => (
                <tr key={l.id} className="border-t hover:bg-gray-50">
                  <td className="px-2 sm:px-3 py-2 text-muted-foreground whitespace-nowrap text-[10px] sm:text-xs">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-3 py-2 truncate max-w-[80px] sm:max-w-[150px]">{l.actor?.email ?? 'System'}</td>
                  <td className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium">{l.action}</td>
                  <td className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-muted-foreground truncate max-w-[60px] sm:max-w-[120px]">{l.targetType}: {l.targetId?.slice(0, 8)}</td>
                  <td className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs hidden sm:table-cell">{l.restaurant?.name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="mt-3 flex justify-between items-center text-xs">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded border px-3 py-1 disabled:opacity-30">Previous</button>
            <span className="text-muted-foreground">Page {page + 1} of {Math.ceil(total / LIMIT)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}
              className="rounded border px-3 py-1 disabled:opacity-30">Next</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
