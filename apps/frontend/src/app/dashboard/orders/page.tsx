'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPatch } from '@/lib/api';

interface OrderItem { id: string; menuItemName: string; quantity: number; unitPrice: number; totalPrice: number; }
interface Order { id: string; tableId: string; status: string; notes: string | null; createdAt: string; items: OrderItem[]; table?: { tableNumber: string }; }

export default function OrdersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      // Get all tables for this restaurant
      const tablesRes = await apiGet<any[]>(`/api/restaurants/${r.data.id}/tables`);
      if (tablesRes.success && tablesRes.data) {
        // For each active table, fetch its orders
        const allOrders: Order[] = [];
        for (const table of tablesRes.data) {
          if (table.sessions?.length > 0) {
            for (const session of table.sessions) {
              try {
                const ordRes = await apiGet<Order[]>(`/api/sessions/${session.sessionToken}/orders`);
                if (ordRes.success && ordRes.data) {
                  allOrders.push(...ordRes.data.map(o => ({ ...o, table: { tableNumber: table.tableNumber } })));
                }
              } catch {}
            }
          }
        }
        setOrders(allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    }
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  async function updateStatus(orderId: string, status: string) {
    if (!restaurant) return;
    await apiPatch(`/api/restaurants/${restaurant.id}/kitchen/orders/${orderId}/status`, { status });
    load();
  }

  const filteredOrders = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  function statusColor(s: string) {
    if (s === 'received') return 'bg-blue-100 text-blue-700';
    if (s === 'preparing') return 'bg-yellow-100 text-yellow-700';
    if (s === 'ready') return 'bg-green-100 text-green-700';
    if (s === 'delivered') return 'bg-gray-100 text-gray-700';
    if (s === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-gray-100';
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Orders & Bills History</h1>

        <div className="mt-4 flex gap-2 border-b">
          {['all', 'received', 'preparing', 'ready', 'delivered', 'cancelled'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
                tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-muted-foreground'
              }`}>
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {filteredOrders.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">No orders yet.</p>
          ) : filteredOrders.map(order => (
            <div key={order.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">Table {order.table?.tableNumber ?? '?'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {order.items?.map(item => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.menuItemName}</span>
                    <span className="text-muted-foreground">NRS {item.totalPrice?.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {order.notes && <p className="mt-2 text-xs italic text-muted-foreground">📝 {order.notes}</p>}
              <div className="mt-2 flex gap-2">
                {order.status === 'received' && (
                  <button onClick={() => updateStatus(order.id, 'preparing')} className="text-xs bg-yellow-100 px-2 py-0.5 rounded">Start Preparing</button>
                )}
                {order.status === 'preparing' && (
                  <button onClick={() => updateStatus(order.id, 'ready')} className="text-xs bg-green-100 px-2 py-0.5 rounded">Mark Ready</button>
                )}
                {order.status === 'ready' && (
                  <button onClick={() => updateStatus(order.id, 'delivered')} className="text-xs bg-gray-100 px-2 py-0.5 rounded">Mark Delivered</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
