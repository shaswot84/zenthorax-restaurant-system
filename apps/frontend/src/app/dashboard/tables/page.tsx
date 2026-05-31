'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface TableData { id: string; tableNumber: string; tableCode: string; qrUrl: string; isActive: boolean; sessions: any[]; }

export default function TablesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const t = await apiGet<TableData[]>(`/api/restaurants/${r.data.id}/tables`);
      if (t.success && t.data) setTables(t.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  async function addTable() {
    if (!restaurant || !tableNumber.trim()) return;
    setSaving(true);
    await apiPost(`/api/restaurants/${restaurant.id}/tables`, { tableNumber: tableNumber.trim() });
    setTableNumber(''); setShowForm(false); setSaving(false);
    load();
  }

  async function removeTable(tableId: string) {
    if (!restaurant || !confirm('Deactivate this table?')) return;
    await apiDelete(`/api/restaurants/${restaurant.id}/tables/${tableId}`);
    load();
  }

  async function reactivateTable(tableId: string) {
    if (!restaurant) return;
    await apiPatch(`/api/restaurants/${restaurant.id}/tables/${tableId}/reactivate`);
    load();
  }

  if (isLoading || loading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tables</h1>
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + Add Table
          </button>
        </div>

        {/* Table grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.length === 0 ? (
            <div className="col-span-full rounded-xl border bg-card p-12 text-center text-muted-foreground">
              No tables yet. Click &ldquo;Add Table&rdquo; to create your first table with a QR code.
            </div>
          ) : tables.map(table => (
            <div key={table.id} className={`rounded-xl border bg-card p-5 shadow-sm ${!table.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Table {table.tableNumber}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Code: {table.tableCode.slice(0, 8)}...
                  </p>
                  {table.sessions?.length > 0 && (
                    <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active session
                    </span>
                  )}
                  {!table.isActive && (
                    <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {/* QR code image */}
                  {table.qrUrl && (
                    <div className="relative group">
                      <img
                        src={`https://btrleznnoyxesidsqaxp.supabase.co/storage/v1/object/public/qr-codes/${restaurant.id}/${table.tableCode}.png`}
                        alt="QR Code"
                        className="h-20 w-20 rounded-lg border"
                      />
                      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/50 rounded-lg">
                        <a
                          href={`https://btrleznnoyxesidsqaxp.supabase.co/storage/v1/object/public/qr-codes/${restaurant.id}/${table.tableCode}.png`}
                          download
                          className="text-xs text-white font-medium hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  )}
                  {table.isActive ? (
                    <button onClick={() => removeTable(table.id)} className="text-xs text-red-400 hover:text-red-600">
                      Deactivate
                    </button>
                  ) : (
                    <button onClick={() => reactivateTable(table.id)} className="text-xs text-green-500 hover:text-green-700">
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground truncate">{table.qrUrl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add table modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Add Table</h2>
            <p className="text-xs text-muted-foreground mt-1">A QR code will be generated automatically.</p>
            <input
              type="text" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
              placeholder="Table number (e.g. T1, 101, Balcony 1)"
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" autoFocus
              onKeyDown={e => e.key === 'Enter' && addTable()}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={addTable} disabled={saving || !tableNumber.trim()}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
