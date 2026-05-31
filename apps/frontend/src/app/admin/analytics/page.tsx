'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const STATUS_COLORS = { Active: '#22c55e', 'Grace Period': '#eab308', Expired: '#ef4444' };

export default function AdminAnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [subData, setSubData] = useState<any>(null);
  const [revData, setRevData] = useState<any[]>([]);
  const [revPlan, setRevPlan] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [subRes, revRes] = await Promise.all([
      apiGet<any>('/api/admin/analytics/subscriptions'),
      apiGet<any[]>(`/api/admin/analytics/subscription-revenue?plan=${revPlan}`),
    ]);
    if (subRes.success && subRes.data) setSubData(subRes.data);
    if (revRes.success && revRes.data) setRevData(revRes.data);
    setLoading(false);
  }, [revPlan]);

  useEffect(() => { if (!isLoading && !user) { router.push('/login'); return; } if (user) load(); }, [user, isLoading, revPlan]);

  if (isLoading || loading || !user) return null;

  const pkg = subData?.packageBreakdown ?? [];
  const collectedRevenue = subData?.collectedRevenue ?? 0;
  const totalSubValue = subData?.totalSubscriptionValue ?? 0;

  const statusDist = [
    { name: 'Active', value: subData?.activeSubscriptions ?? 0, color: STATUS_COLORS.Active },
    { name: 'Grace Period', value: subData?.gracePeriod ?? 0, color: STATUS_COLORS['Grace Period'] },
    { name: 'Expired', value: subData?.expired ?? 0, color: STATUS_COLORS.Expired },
  ].filter(d => d.value > 0);

  const packageChart = {
    labels: pkg.map((p: any) => p.packageName),
    datasets: [
      { label: 'Active Restaurants', data: pkg.map((p: any) => p.activeCount), backgroundColor: '#f97316', borderRadius: 4 },
      { label: 'Subscription Value (NRS)', data: pkg.map((p: any) => p.subscriptionValue), backgroundColor: '#3b82f6', borderRadius: 4 },
    ],
  };

  const statusChart = {
    labels: statusDist.map(d => d.name),
    datasets: [{ label: 'Restaurants', data: statusDist.map(d => d.value), backgroundColor: statusDist.map(d => d.color), borderRadius: 4 }],
  };

  const revenueTrendChart = {
    labels: revData.map(d => d.day),
    datasets: [{
      label: 'Subscription Revenue (NRS)', data: revData.map(d => d.revenue),
      borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)',
      fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#f97316',
    }],
  };

  return (
    <DashboardLayout variant="admin">
      <div className="w-full">
        <h1 className="text-xl sm:text-2xl font-bold">Platform Analytics</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Subscription-based metrics</p>

        <div className="mt-4 grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 max-w-full">
          {[
            { label: 'Restaurants', value: subData?.totalRestaurants ?? 0, color: 'text-gray-700' },
            { label: 'Active', value: subData?.activeSubscriptions ?? 0, color: 'text-green-600' },
            { label: 'Grace', value: subData?.gracePeriod ?? 0, color: 'text-yellow-600' },
            { label: 'Expired', value: subData?.expired ?? 0, color: 'text-red-600' },
            { label: 'Collected', value: `NRS ${collectedRevenue.toLocaleString()}`, color: 'text-green-600' },
            { label: 'Sub Value', value: `NRS ${totalSubValue.toLocaleString()}`, color: 'text-brand-600' },
          ].map(k => (
            <div key={k.label} className="rounded-lg border bg-card px-2 py-2 sm:p-3">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">{k.label}</p>
              <p className={`mt-0.5 text-sm sm:text-lg font-bold ${k.color} truncate`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-card p-2 sm:p-3 max-w-full">
          <h2 className="text-xs sm:text-sm font-semibold mb-1">Subscription by Package</h2>
          {pkg.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 text-xs">No data yet.</p>
          ) : (
            <div className="w-full overflow-hidden" style={{ height: 'min(200px, 35vh)' }}>
              <Bar data={packageChart} options={{
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 5, right: 5, bottom: 0, left: 0 } },
                scales: { x: { ticks: { font: { size: 8 } } }, y: { ticks: { font: { size: 8 } } } },
              }} />
            </div>
          )}
        </div>

        {/* Restaurant Subscription Status */}
        {subData?.restaurantStatuses && (
          <div className="mt-3 rounded-lg border bg-card p-2 sm:p-3 max-w-full">
            <h2 className="text-xs sm:text-sm font-semibold mb-1">Subscription Status</h2>
            <div className="space-y-2 max-w-full">
              {subData.restaurantStatuses.active?.length > 0 && (
                <details open>
                  <summary className="text-[11px] sm:text-xs font-semibold text-green-700 cursor-pointer">
                    🟢 Active ({subData.restaurantStatuses.active.length})
                  </summary>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto mt-1">
                    {subData.restaurantStatuses.active.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-[10px] sm:text-xs border-b py-1">
                        <span className="font-medium truncate max-w-[100px] sm:max-w-[180px]">{r.restaurantName}</span>
                        <span className="text-muted-foreground hidden sm:inline">{r.packageName}</span>
                        <span className={`font-medium ${r.daysRemaining <= 7 ? 'text-red-600' : r.daysRemaining <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {Math.round(r.daysRemaining)}d
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {subData.restaurantStatuses.gracePeriod?.length > 0 && (
                <details>
                  <summary className="text-[11px] sm:text-xs font-semibold text-yellow-700 cursor-pointer">
                    🟡 Grace Period ({subData.restaurantStatuses.gracePeriod.length})
                  </summary>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto mt-1">
                    {subData.restaurantStatuses.gracePeriod.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-[10px] sm:text-xs border-b py-1">
                        <span className="font-medium truncate max-w-[100px] sm:max-w-[180px]">{r.restaurantName}</span>
                        <span className="text-muted-foreground hidden sm:inline">{r.packageName}</span>
                        <span className="font-medium text-yellow-600">{Math.abs(Math.round(r.daysRemaining))}d ago</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {subData.restaurantStatuses.expired?.length > 0 && (
                <details>
                  <summary className="text-[11px] sm:text-xs font-semibold text-red-700 cursor-pointer">
                    🔴 Expired ({subData.restaurantStatuses.expired.length})
                  </summary>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto mt-1">
                    {subData.restaurantStatuses.expired.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-[10px] sm:text-xs border-b py-1 opacity-50">
                        <span className="font-medium truncate max-w-[100px] sm:max-w-[180px]">{r.restaurantName}</span>
                        <span className="text-muted-foreground hidden sm:inline">{r.packageName}</span>
                        <span className="font-medium text-red-500">{Math.abs(Math.round(r.daysRemaining))}d</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Revenue Trend */}
        <div className="mt-3 rounded-lg border bg-card p-2 sm:p-3 max-w-full">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
            <h2 className="text-xs sm:text-sm font-semibold">Revenue Trend</h2>
            <select value={revPlan} onChange={e => setRevPlan(e.target.value)} className="rounded border px-1.5 py-0.5 text-[9px] sm:text-[10px]">
              <option value="all">All</option>
              <option value="1">Monthly</option>
              <option value="3">3-Month</option>
              <option value="6">6-Month</option>
            </select>
          </div>
          {revData.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 text-xs">No data yet.</p>
          ) : (
            <div className="w-full overflow-hidden" style={{ height: 'min(200px, 35vh)' }}>
              <Line data={revenueTrendChart} options={{
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 5, right: 5, bottom: 0, left: 0 } },
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { maxTicksLimit: 5, font: { size: 8 } } },
                  y: { ticks: { maxTicksLimit: 5, font: { size: 8 }, callback: (v: any) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v } },
                },
              }} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
