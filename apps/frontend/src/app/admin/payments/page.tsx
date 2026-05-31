'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';

export default function AdminPaymentsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    const res = await apiGet<any[]>('/api/admin/payments/pending');
    if (res.success && res.data) setPayments(res.data);
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  async function verify(id: string) {
    await apiPost(`/api/admin/payments/${id}/verify`);
    load();
  }

  async function reject(id: string) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    await apiPost(`/api/admin/payments/${id}/reject`, { reason });
    load();
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Payment Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">Verify or reject subscription payments</p>

        <div className="mt-6 space-y-3">
          {payments.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">No pending payments.</div>
          ) : payments.map(p => (
            <div key={p.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg">NRS {p.amountNrs?.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Restaurant: {p.restaurant?.name}</p>
                  <p className="text-sm text-muted-foreground">Method: {p.paymentMethod}</p>
                  <p className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
                  {p.proofUrl && (
                    <a href={p.proofUrl} target="_blank" rel="noopener" className="text-xs text-brand-500 hover:underline mt-1 inline-block">
                      View Payment Proof
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => verify(p.id)}
                    className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">
                    Verify
                  </button>
                  <button onClick={() => reject(p.id)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
