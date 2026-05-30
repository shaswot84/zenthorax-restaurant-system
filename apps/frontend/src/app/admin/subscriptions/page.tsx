'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';

export default function AdminSubscriptionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function loadRequests() {
    setLoading(true);
    const res = await apiGet<any>('/api/admin/subscriptions/pending');
    if (res.success && res.data) setRequests(res.data);
    setLoading(false);
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    loadRequests();
  }, [user, isLoading]);

  async function handleApprove(id: string) {
    await apiPost(`/api/admin/subscriptions/${id}/approve`);
    loadRequests();
  }

  async function handleReject(id: string) {
    await apiPost(`/api/admin/subscriptions/${id}/reject`, { reason: rejectReason });
    setRejectId(null);
    setRejectReason('');
    loadRequests();
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Subscription Requests</h1>
        <p className="mt-1 text-muted-foreground">Approve or reject pending restaurant subscriptions</p>

        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <p className="text-muted-foreground">No pending subscription requests</p>
            </div>
          ) : requests.map((sub: any) => (
            <div key={sub.id} className="rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{sub.restaurant?.name ?? 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground">Slug: {sub.restaurant?.slug}</p>
                  <p className="text-sm text-muted-foreground">Contact: {sub.restaurant?.contactNumber}</p>
                  <p className="text-sm text-muted-foreground">Address: {sub.restaurant?.address}</p>
                  <div className="mt-2 flex gap-3 text-sm">
                    <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-700">
                      {sub.package?.name ?? 'Unknown Package'}
                    </span>
                    <span className="text-muted-foreground">
                      NRS {sub.package?.priceNrs?.toLocaleString() ?? '?'} / {sub.package?.durationMonths} month(s)
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(sub.id)}
                    className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectId(sub.id)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {/* Reject reason modal inline */}
              {rejectId === sub.id && (
                <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                  <label className="block text-sm font-medium text-red-800">Reason for rejection (required):</label>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Explain why this subscription is being rejected..."
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleReject(sub.id)}
                      disabled={!rejectReason}
                      className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => { setRejectId(null); setRejectReason(''); }}
                      className="rounded-lg border px-4 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
