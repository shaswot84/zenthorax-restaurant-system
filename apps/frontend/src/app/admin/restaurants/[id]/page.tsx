'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';

export default function AdminRestaurantDetailPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    loadRestaurant();
  }, [user, isLoading, params.id]);

  async function loadRestaurant() {
    const res = await apiGet<any>(`/api/admin/restaurants/${params.id}`);
    if (res.success && res.data) setRestaurant(res.data);
    else router.push('/admin/restaurants');
    setLoading(false);
  }

  async function handleAction(action: string, subId?: string) {
    setActionLoading(action);
    if (action === 'approve' && subId) {
      await apiPost(`/api/admin/subscriptions/${subId}/approve`);
    } else if (action === 'reject') {
      await apiPost(`/api/admin/restaurants/${params.id}/reject`, { reason: 'Rejected by admin' });
    } else if (action === 'suspend') {
      await apiPost(`/api/admin/restaurants/${params.id}/suspend`);
    } else if (action === 'reactivate') {
      await apiPost(`/api/admin/restaurants/${params.id}/reactivate`);
    }
    setActionLoading('');
    loadRestaurant();
  }

  if (isLoading || loading) {
    return <DashboardLayout variant="admin"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></DashboardLayout>;
  }
  if (!restaurant) return null;

  const sub = restaurant.subscription;

  return (
    <DashboardLayout variant="admin">
      <div>
        <button onClick={() => router.back()} className="text-sm text-brand-500 hover:underline mb-4">&larr; Back to restaurants</button>
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>

        {/* Status */}
        <div className="mt-4 flex gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            restaurant.status === 'active' ? 'bg-green-100 text-green-700' :
            restaurant.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>{restaurant.status}</span>
          {sub && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sub.status === 'active' ? 'bg-green-100 text-green-700' :
              sub.status === 'pending' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>Subscription: {sub.status}</span>
          )}
        </div>

        {/* Details */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold">Restaurant Info</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Slug:</span><span>{restaurant.slug}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Contact:</span><span>{restaurant.contactNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Address:</span><span>{restaurant.address}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Category:</span><span>{restaurant.category ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT:</span><span>{restaurant.vatPercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Service Charge:</span><span>{restaurant.serviceChargePercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{restaurant.taxPercentage}%</span></div>
            </dl>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold">Stats</h3>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-bold">{restaurant.menuItemCount}</p><p className="text-xs text-muted-foreground">Menu Items</p></div>
              <div><p className="text-2xl font-bold">{restaurant.tableCount}</p><p className="text-xs text-muted-foreground">Tables</p></div>
              <div><p className="text-2xl font-bold">{restaurant.orderCount}</p><p className="text-xs text-muted-foreground">Orders</p></div>
            </div>
          </div>
        </div>

        {/* Subscription */}
        {sub && (
          <div className="mt-6 rounded-xl border bg-card p-6">
            <h3 className="font-semibold">Subscription</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Package:</span><span>{sub.package?.name ?? 'Unknown'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span>{sub.status}</span></div>
              {sub.startDate && <div className="flex justify-between"><span className="text-muted-foreground">Start:</span><span>{new Date(sub.startDate).toLocaleDateString()}</span></div>}
              {sub.endDate && <div className="flex justify-between"><span className="text-muted-foreground">End:</span><span>{new Date(sub.endDate).toLocaleDateString()}</span></div>}
            </dl>

            {/* Approval actions */}
            {sub.status === 'pending' && (
              <div className="mt-4 flex gap-3">
                <button onClick={() => handleAction('approve', sub.id)} disabled={!!actionLoading}
                  className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50">
                  {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                </button>
                <button onClick={() => { if (confirm('Reject this restaurant?')) handleAction('reject'); }} disabled={!!actionLoading}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Reject
                </button>
              </div>
            )}
          </div>
        )}

        {/* Suspend/Reactivate */}
        <div className="mt-6 flex gap-3">
          {restaurant.status === 'active' && (
            <button onClick={() => handleAction('suspend')} disabled={!!actionLoading}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
              Suspend Restaurant
            </button>
          )}
          {restaurant.status === 'suspended' && (
            <button onClick={() => handleAction('reactivate')} disabled={!!actionLoading}
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">
              Reactivate Restaurant
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
