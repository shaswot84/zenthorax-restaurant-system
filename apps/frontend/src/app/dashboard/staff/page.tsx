'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface StaffRequest { id: string; userId: string; isApproved: boolean; createdAt: string; user: { email: string; fullName: string | null }; }

export default function StaffPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [requests, setRequests] = useState<StaffRequest[]>([]);

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const reqs = await apiGet<StaffRequest[]>(`/api/restaurants/${r.data.id}/kitchen/staff-requests`);
      if (reqs.success && reqs.data) setRequests(reqs.data);
    }
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  async function approve(reqId: string) {
    if (!restaurant) return;
    await apiPost(`/api/restaurants/${restaurant.id}/kitchen/staff-requests/${reqId}/approve`);
    load();
  }

  async function decline(reqId: string) {
    if (!restaurant || !confirm('Decline this request?')) return;
    await apiDelete(`/api/restaurants/${restaurant.id}/kitchen/staff-requests/${reqId}`);
    load();
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <p className="mt-1 text-muted-foreground">Approve or decline kitchen staff requests</p>

        <div className="mt-6 space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              No staff requests yet.
            </div>
          ) : requests.map(req => (
            <div key={req.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div>
                <p className="font-semibold text-sm">{req.user?.fullName || req.user?.email}</p>
                <p className="text-xs text-muted-foreground">{req.user?.email}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  req.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {req.isApproved ? 'Approved' : 'Pending'}
                </span>
              </div>
              {!req.isApproved && (
                <div className="flex gap-2">
                  <button onClick={() => approve(req.id)}
                    className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
                    Approve
                  </button>
                  <button onClick={() => decline(req.id)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                    Decline
                  </button>
                </div>
              )}
              {req.isApproved && (
                <button onClick={() => decline(req.id)}
                  className="rounded-lg border px-3 py-1.5 text-xs text-red-400 hover:text-red-600">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
