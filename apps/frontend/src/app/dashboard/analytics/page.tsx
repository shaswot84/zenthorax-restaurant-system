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
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [billStats, setBillStats] = useState<any[]>([]);
  const [period, setPeriod] = useState('daily');

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const [s, rev, it, bs] = await Promise.all([
        apiGet<any>(`/api/restaurants/${r.data.id}/analytics/summary`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/revenue?period=${period}`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/items`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/bills`),
      ]);
      if (s.success && s.data) setSummary(s.data);
      if (rev.success && rev.data) setRevenue(rev.data);
      if (it.success && it.data) setItems(it.data);
      if (bs.success && bs.data) setBillStats(bs.data);
    }
  }, [period]);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading, period]);

  if (isLoading || !user) return null;

  const revenueChart = {
    labels: revenue.map(d => d.day),
    datasets: [{
      label: 'Revenue (NRS)', data: revenue.map(d => d.revenue),
      borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)',
      fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#f97316',
    }],
  };

  const itemsChart = {
    labels: items.slice(0, 8).map(d => d.name),
    datasets: [{
      label: 'Quantity Sold', data: items.slice(0, 8).map(d => d.quantity),
      backgroundColor: CHART_COLORS,
    }],
  };

  const billsChart = {
    labels: billStats.map(d => d.status.replace('_', ' ')),
    datasets: [{
      data: billStats.map(d => d.count),
      backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#6b7280'],
    }],
  };

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {[
            { label: 'Revenue Today', value: `NRS ${(summary?.revenueToday ?? 0).toLocaleString()}`, color: 'text-green-600' },
            { label: 'Active Orders', value: summary?.activeOrders ?? 0, color: 'text-blue-600' },
            { label: 'Total Revenue', value: `NRS ${(summary?.totalRevenue ?? 0).toLocaleString()}`, color: 'text-brand-600' },
            { label: 'Paid Bills', value: summary?.totalPaidBills ?? 0, color: 'text-purple-600' },
            { label: 'Avg Order', value: `NRS ${(summary?.avgOrderValue ?? 0).toLocaleString()}`, color: 'text-yellow-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border bg-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Revenue Trend</h2>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded border px-2 py-1 text-xs">
              <option value="daily">Daily (14d)</option>
              <option value="weekly">Weekly (7d)</option>
              <option value="monthly">Monthly (30d)</option>
            </select>
          </div>
          {revenue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No revenue data yet.</p>
          ) : (
            <div className="h-[300px]">
              <Line data={revenueChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Top Selling Items</h2>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <div className="h-[280px]">
                <Bar data={itemsChart} options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Bills Breakdown</h2>
            {billStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <div className="w-[250px]">
                  <Pie data={billsChart} options={{ responsive: true, maintainAspectRatio: true }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
