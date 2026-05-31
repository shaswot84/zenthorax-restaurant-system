'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';

interface OrderItem { id: string; menuItemName: string; quantity: number; totalPrice: number; }
interface Order { id: string; status: string; notes: string | null; createdAt: string; items: OrderItem[]; table?: { tableNumber: string }; }

export default function OrdersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const tablesRes = await apiGet<any[]>(`/api/restaurants/${r.data.id}/tables`);
      if (tablesRes.success && tablesRes.data) {
        const all: Order[] = [];
        for (const table of tablesRes.data) {
          if (table.sessions?.length > 0) {
            for (const session of table.sessions) {
              try {
                const ordRes = await apiGet<Order[]>(`/api/sessions/${session.sessionToken}/orders`);
                if (ordRes.success && ordRes.data) {
                  all.push(...ordRes.data.map(o => ({ ...o, table: { tableNumber: table.tableNumber } })));
                }
              } catch {}
            }
          }
        }
        // Only show active orders (received, preparing, ready) and cancelled
        const active = all.filter(o => ['received', 'preparing', 'ready', 'cancelled'].includes(o.status));
        setOrders(active.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    }
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  // Poll orders every 12s for real-time kitchen updates
  useEffect(() => { if (!restaurant) return; const i = setInterval(() => load(), 12000); return () => clearInterval(i); }, [restaurant, load]);

  function statusColor(s: string) {
    if (s === 'received') return 'bg-blue-100 text-blue-700';
    if (s === 'preparing') return 'bg-yellow-100 text-yellow-700';
    if (s === 'ready') return 'bg-green-100 text-green-700';
    if (s === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-gray-100';
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Active Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Orders being prepared, ready, or cancelled</p>

        <div className="mt-4 space-y-3">
          {orders.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">No active orders.</p>
          ) : orders.map(order => (
            <div key={order.id} className={`rounded-lg border bg-card p-4 ${order.status === 'cancelled' ? 'opacity-60 border-red-200' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">Table {order.table?.tableNumber ?? '?'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {order.items?.map(item => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className={order.status === 'cancelled' ? 'line-through' : ''}>
                      {item.quantity}x {item.menuItemName}
                    </span>
                    <span className="text-muted-foreground">NRS {item.totalPrice?.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {order.notes && <p className="mt-2 text-xs italic text-muted-foreground">📝 {order.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
