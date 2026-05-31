'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface OrderItem { id: string; menuItemName: string; quantity: number; }
interface Order { id: string; tableNumber?: string; status: string; notes: string | null; items: OrderItem[]; createdAt: string; }
interface Ticket { tableNumber: string; orders: Order[]; latestOrderAt: string; }

export default function KitchenPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [staffRecord, setStaffRecord] = useState<any>(null);
  const [allRestaurants, setAllRestaurants] = useState<any[]>([]);
  const [showRestaurants, setShowRestaurants] = useState(false);
  const [joining, setJoining] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadTickets = useCallback(async () => {
    if (!restaurant) return;
    const res = await apiGet<Ticket[]>(`/api/restaurants/${restaurant.id}/kitchen/orders`);
    if (res.success && res.data) setTickets(res.data);
  }, [restaurant]);

  // Initial load
  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    if (user) {
      apiGet<any>('/api/auth/me').then(r => {
        if (r.success) {
          const staff = r.data.kitchenStaff;
          setStaffRecord(staff);
          // If approved kitchen staff, fetch restaurant by staff's restaurantId
          if (staff?.isApproved && staff?.restaurantId) {
            apiGet<any>(`/api/restaurants/${staff.restaurantId}/menu`).then(() => {
              // Just use the restaurant ID directly from staff record
              setRestaurant({ id: staff.restaurantId });
            });
          } else {
            setRestaurant(r.data.restaurant);
          }
        }
      }).finally(() => setLoading(false));
    }
  }, [user, isLoading]);

  async function loadRestaurants() {
    const res = await apiGet<any[]>('/api/kitchen/restaurants');
    if (res.success && res.data) setAllRestaurants(res.data);
    setShowRestaurants(true);
  }

  async function requestJoin(restaurantId: string) {
    setJoining(restaurantId);
    const res = await apiPost<{ id: string; isApproved: boolean; status: string }>('/api/auth/kitchen/request-access', { restaurantId });
    setJoining('');
    if (res.success && res.data) {
      // Update staff record locally to show pending state immediately
      setStaffRecord({ id: res.data.id, restaurantId, isApproved: false });
    }
  }

  // Load tickets when restaurant is set
  useEffect(() => { if (restaurant) loadTickets(); }, [restaurant]);

  // Supabase Realtime subscription for new orders
  useEffect(() => {
    if (!restaurant) return;
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => {
        loadTickets();
        // Play sound for new order
        if (soundEnabled && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => loadTickets())
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [restaurant, soundEnabled, loadTickets]);

  async function updateStatus(orderId: string, status: string) {
    if (!restaurant) return;
    await apiPatch(`/api/restaurants/${restaurant.id}/kitchen/orders/${orderId}/status`, { status });
    loadTickets();
  }

  function getStatusColor(status: string) {
    if (status === 'received') return 'bg-blue-100 text-blue-700 border-blue-300';
    if (status === 'preparing') return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (status === 'ready') return 'bg-green-100 text-green-700 border-green-300';
    return 'bg-gray-100';
  }

  function getTimeAgo(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  if (isLoading || loading || !user) return null;

  return (
    <DashboardLayout variant="kitchen">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Kitchen Display</h1>
            <p className="text-sm text-muted-foreground">Active tickets</p>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${soundEnabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
          >
            {soundEnabled ? '🔔 Sound ON' : '🔕 Sound OFF'}
          </button>
        </div>

        {/* Hidden audio element for notifications */}
        <audio ref={audioRef} src="/sounds/ting-ting.mp3" preload="auto" />

        {/* No restaurant assigned — show restaurant browser */}
        {!restaurant && !staffRecord && (
          <div className="mt-6 rounded-xl border bg-card p-8 text-center">
            <p className="text-3xl mb-2">🏪</p>
            <h3 className="text-lg font-bold">No Restaurant Assigned</h3>
            <p className="mt-1 text-sm text-muted-foreground">Browse available restaurants and send a join request.</p>
            {!showRestaurants ? (
              <button onClick={loadRestaurants} className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                Browse Restaurants
              </button>
            ) : (
              <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                {allRestaurants.map(r => {
                  const isRequested = staffRecord?.restaurantId === r.id;
                  return (
                    <div key={r.id} className={`flex items-center justify-between rounded-lg border p-3 ${isRequested ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                      <div>
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.address}</p>
                        {isRequested && (
                          <p className="mt-1 text-xs font-medium text-blue-600">
                            {staffRecord?.isApproved ? '✓ Approved' : '⏳ Request sent — waiting for approval'}
                          </p>
                        )}
                      </div>
                      {isRequested ? (
                        <span className="text-xs text-blue-500 font-medium">Pending</span>
                      ) : (
                        <button onClick={() => requestJoin(r.id)} disabled={joining === r.id}
                          className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                          {joining === r.id ? 'Sending...' : 'Join'}
                        </button>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setShowRestaurants(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Pending approval state */}
        {!restaurant && staffRecord && !staffRecord.isApproved && (
          <div className="mt-6 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6 text-center">
            <p className="text-3xl">⏳</p>
            <h3 className="text-lg font-bold text-yellow-800">Awaiting Approval</h3>
            <p className="mt-1 text-sm text-yellow-700">Your request has been sent. The restaurant manager will review it.</p>
          </div>
        )}

        {/* Ticket grid — only shown when assigned to an active restaurant */}
        {restaurant && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {tickets.length === 0 ? (
            <div className="col-span-full rounded-xl border bg-card p-16 text-center">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-lg font-medium text-muted-foreground">No active orders</p>
              <p className="text-sm text-muted-foreground mt-1">Waiting for orders to come in...</p>
            </div>
          ) : tickets.map((ticket, ti) => (
            <div key={ti} className="rounded-xl border-2 border-brand-200 bg-card shadow-sm overflow-hidden">
              {/* Ticket header */}
              <div className="bg-brand-50 px-4 py-3 border-b border-brand-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-brand-800">Table {ticket.tableNumber}</h3>
                  <span className="text-xs text-muted-foreground">{getTimeAgo(ticket.latestOrderAt)}</span>
                </div>
              </div>

              {/* Order items */}
              <div className="p-4">
                {ticket.orders.map(order => (
                  <div key={order.id} className="mb-4 last:mb-0">
                    {/* Items list */}
                    <ul className="space-y-1.5">
                      {order.items.map(item => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span className="flex-1">
                            <span className="font-semibold">{item.quantity}x</span> {item.menuItemName}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {order.notes && (
                      <p className="mt-1 text-xs italic text-brand-600 bg-brand-50 px-2 py-1 rounded">
                        📝 {order.notes}
                      </p>
                    )}

                    {/* Status badge + actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                      <div className="flex gap-1">
                        {order.status === 'received' && (
                          <button onClick={() => updateStatus(order.id, 'preparing')}
                            className="rounded bg-yellow-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-yellow-600">
                            Start Preparing
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateStatus(order.id, 'ready')}
                            className="rounded bg-green-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-600">
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <span className="text-xs text-green-600 font-medium">✓ Ready for pickup</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}
