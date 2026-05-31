'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [period, setPeriod] = useState('daily');

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const [s, rev, it] = await Promise.all([
        apiGet<any>(`/api/restaurants/${r.data.id}/analytics/summary`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/revenue?period=${period}`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/items`),
      ]);
      if (s.success && s.data) setSummary(s.data);
      if (rev.success && rev.data) setRevenue(rev.data);
      if (it.success && it.data) setItems(it.data);
    }
  }, [period]);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading, period]);

  if (isLoading || !user) return null;

  const revenueChart = {
    labels: revenue.map(d => {
      const date = new Date(d.day);
      return period === 'monthly' ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [{
      label: 'Revenue (NRS)', data: revenue.map(d => d.revenue),
      borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)',
      fill: true, tension: 0.3, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#f97316',
    }],
  };

  const itemsChart = {
    labels: items.slice(0, 8).map(d => d.name),
    datasets: [{
      label: 'Quantity Sold', data: items.slice(0, 8).map(d => d.quantity),
      backgroundColor: CHART_COLORS,
    }],
  };

  return (
    <DashboardLayout variant="restaurant">
      <div className="max-w-full">
        <h1 className="text-xl sm:text-2xl font-bold">Analytics</h1>

        {/* KPI Cards — responsive grid */}
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Revenue Today', value: `NRS ${(summary?.revenueToday ?? 0).toLocaleString()}`, color: 'text-green-600' },
            { label: 'Active Orders', value: summary?.activeOrders ?? 0, color: 'text-blue-600' },
            { label: 'Total Revenue', value: `NRS ${(summary?.totalRevenue ?? 0).toLocaleString()}`, color: 'text-brand-600' },
            { label: 'Paid Bills', value: summary?.totalPaidBills ?? 0, color: 'text-purple-600' },
            { label: 'Avg Order', value: `NRS ${(summary?.avgOrderValue ?? 0).toLocaleString()}`, color: 'text-yellow-600' },
          ].map(k => (
            <div key={k.label} className="rounded-lg border bg-card p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{k.label}</p>
              <p className={`mt-1 text-base sm:text-xl font-bold ${k.color} truncate`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Revenue Trend — compact */}
        <div className="mt-4 rounded-lg border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h2 className="text-sm sm:text-lg font-semibold">Revenue Trend</h2>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded border px-2 py-1 text-[10px] sm:text-xs">
              <option value="daily">14 Days</option>
              <option value="weekly">7 Days</option>
              <option value="monthly">30 Days</option>
            </select>
          </div>
          {revenue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-xs">No revenue data yet.</p>
          ) : (
            <div className="w-full" style={{ height: 'min(280px, 50vh)' }}>
              <Line data={revenueChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } },
                  y: { ticks: { font: { size: 10 }, callback: (v) => typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : v } },
                },
              }} />
            </div>
          )}
        </div>

        {/* Top Selling Items — full width on mobile, half on desktop */}
        <div className="mt-4 rounded-lg border bg-card p-3 sm:p-4">
          <h2 className="text-sm sm:text-lg font-semibold mb-2">Top Selling Items</h2>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-xs">No data yet.</p>
          ) : (
            <div className="w-full" style={{ height: 'min(250px, 40vh)' }}>
              <Bar data={itemsChart} options={{
                indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { font: { size: 10 } } },
                  y: { ticks: { font: { size: 10 } } },
                },
              }} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
