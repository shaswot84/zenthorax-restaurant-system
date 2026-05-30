'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';

export default function AdminRestaurantsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await apiGet<any>(`/api/admin/restaurants?${params.toString()}`);
    if (res.success && res.data) setRestaurants(res.data);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    loadRestaurants();
  }, [user, isLoading, loadRestaurants]);

  async function handleAction(id: string, action: string) {
    if (action === 'suspend') {
      await apiPost(`/api/admin/restaurants/${id}/suspend`);
    } else if (action === 'reactivate') {
      await apiPost(`/api/admin/restaurants/${id}/reactivate`);
    }
    loadRestaurants();
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Restaurants</h1>

        {/* Search & Filter */}
        <div className="mt-4 flex gap-3">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, slug, contact..." className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : restaurants.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No restaurants found</td></tr>
              ) : restaurants.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <a href={`/admin/restaurants/${r.id}`} className="text-brand-500 hover:underline">{r.name}</a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.slug}</td>
                  <td className="px-4 py-3">{r.contactNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === 'active' ? 'bg-green-100 text-green-700' :
                      r.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button onClick={() => router.push(`/admin/restaurants/${r.id}`)} className="text-brand-500 hover:underline text-xs">View</button>
                    {r.status === 'active' && (
                      <button onClick={() => handleAction(r.id, 'suspend')} className="text-red-500 hover:underline text-xs">Suspend</button>
                    )}
                    {r.status === 'suspended' && (
                      <button onClick={() => handleAction(r.id, 'reactivate')} className="text-green-500 hover:underline text-xs">Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
