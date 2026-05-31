'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';

export default function SubscriptionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const s = await apiGet<any>(`/api/restaurants/${r.data.id}/subscription`);
      if (s.success && s.data) setSubData(s.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  async function handleAction(action: string) {
    if (!restaurant) return;
    setActionLoading(action);
    if (action === 'renew') {
      await apiPost(`/api/restaurants/${restaurant.id}/subscription/request-renew`);
    }
    setActionLoading('');
    load();
  }

  const sub = subData?.subscription;
  const payments = subData?.payments ?? [];
  const pkg = sub?.package;

  if (isLoading || loading || !user) return null;

  const daysLeft = sub?.endDate ? Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000)) : null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Current Plan */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Current Plan</h3>
            {sub ? (
              <div className="mt-2">
                <p className="text-2xl font-bold">{pkg?.name ?? 'Unknown'}</p>
                <p className="text-sm text-muted-foreground mt-1">NRS {pkg?.priceNrs?.toLocaleString() ?? '?'} / {pkg?.durationMonths} month(s)</p>
              </div>
            ) : (
              <p className="text-muted-foreground mt-2">No active subscription</p>
            )}
          </div>

          {/* Status */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
            {sub ? (
              <div className="mt-2">
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                  sub.status === 'active' ? 'bg-green-100 text-green-700' :
                  sub.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{sub.status}</span>
                {sub.startDate && <p className="text-sm text-muted-foreground mt-2">Started: {new Date(sub.startDate).toLocaleDateString()}</p>}
                {sub.endDate && <p className="text-sm text-muted-foreground">Expires: {new Date(sub.endDate).toLocaleDateString()}</p>}
                {daysLeft !== null && (
                  <p className={`text-sm font-bold mt-1 ${daysLeft <= 7 ? 'text-red-600' : 'text-green-600'}`}>
                    {daysLeft} days remaining
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground mt-2">No subscription</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {sub && sub.status === 'active' && (
          <div className="mt-6 flex gap-3">
            <button onClick={() => handleAction('renew')} disabled={!!actionLoading}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {actionLoading === 'renew' ? 'Requesting...' : '🔄 Request Renewal'}
            </button>
          </div>
        )}
        {sub && sub.status === 'pending' && (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            ⏳ Your subscription request is pending approval from the Zenthorax team.
          </div>
        )}

        {/* Payment History */}
        <div className="mt-8">
          <h2 className="text-lg font-bold">Payment History</h2>
          {payments.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">No payments yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                  <div>
                    <p className="font-semibold">NRS {p.amountNrs?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{p.paymentMethod} · {new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === 'verified' ? 'bg-green-100 text-green-700' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{p.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
