'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface MenuItem { id: string; categoryId: string; name: string; description: string | null; price: number; imageUrl: string | null; isAvailable: boolean; }
interface Category { id: string; name: string; sortOrder: number; items: MenuItem[]; }
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; }
interface TableData { restaurantId: string; restaurantName: string; tableId: string; tableNumber: string; sessionToken: string; }

export default function QRMenuPage() {
  const params = useParams<{ slug: string; tableCode: string }>();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [billStatus, setBillStatus] = useState<string | null>(null);
  const [requestingBill, setRequestingBill] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/tables/validate?slug=${params.slug}&code=${params.tableCode}`,
      );
      const json = await res.json();
      if (json.success && json.data) {
        setTableData(json.data);
        // Load menu
        const menuRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/restaurants/${json.data.restaurantId}/menu`);
        const menuJson = await menuRes.json();
        if (menuJson.success && menuJson.data) setCategories(menuJson.data);
        setStatus('valid');
      } else {
        setError(json.error?.message ?? 'Invalid QR code');
        setStatus('invalid');
      }
    } catch {
      setError('Unable to connect. Check your internet.');
      setStatus('invalid');
    }
  }, [params.slug, params.tableCode]);

  useEffect(() => { load(); }, [load]);

  // --- Cart helpers ---
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.menuItemId !== id));
    else setCart(prev => prev.map(i => i.menuItemId === id ? { ...i, quantity: qty } : i));
  }

  async function requestBill() {
    if (!tableData) return;
    setRequestingBill(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/bills/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: tableData.sessionToken }),
      });
      const json = await res.json();
      if (json.success) setBillStatus(json.data.status);
    } catch {}
    setRequestingBill(false);
  }

  async function placeOrder() {
    if (!tableData || cart.length === 0) return;
    setPlacingOrder(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: tableData.sessionToken,
          items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLastOrder(json.data.id);
        setOrderStatus('received');
        setCart([]);
        setShowCart(false);
        // Poll for status updates
        pollOrderStatus(json.data.id);
      }
    } catch {}
    setPlacingOrder(false);
  }

  async function pollOrderStatus(orderId: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/orders/${orderId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setOrderStatus(json.data.status);
        if (json.data.status === 'ready' || json.data.status === 'delivered') clearInterval(interval);
      }
    }, 5000);
  }

  const filteredItems = activeCat === 'all'
    ? categories.flatMap(c => c.items)
    : (categories.find(c => c.id === activeCat)?.items ?? []);

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100"><span className="text-2xl">⚠️</span></div>
          <h1 className="mt-4 text-xl font-bold">QR Code Not Valid</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-bold">{tableData?.restaurantName}</h1>
        <p className="text-xs text-muted-foreground">Table: {tableData?.tableNumber}</p>
      </header>

      {/* Category pills */}
      <div className="sticky top-[57px] z-10 border-b bg-white px-2 py-2 overflow-x-auto">
        <div className="flex gap-1.5 whitespace-nowrap">
          <button onClick={() => setActiveCat('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeCat === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeCat === c.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Item grid */}
      <main className={`p-3 ${cart.length > 0 ? 'pb-20' : ''}`}>
        {lastOrder && (
          <div className="mb-4 rounded-xl border-2 border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <div>
                <p className="font-semibold text-green-800">Order Placed!</p>
                <p className="text-sm text-green-700">Status: <span className="font-bold capitalize">{orderStatus}</span></p>
              </div>
            </div>
            <button onClick={() => { setLastOrder(null); setOrderStatus(null); }}
              className="mt-2 w-full rounded-lg border border-green-300 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100">
              Order More
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filteredItems.length === 0 ? (
            <p className="col-span-2 py-12 text-center text-sm text-muted-foreground">No items in this category.</p>
          ) : filteredItems.map(item => (
            <div key={item.id}
              className={`rounded-xl border bg-white p-3 shadow-sm ${!item.isAvailable ? 'opacity-40' : ''}`}>
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="mb-2 h-28 w-full rounded-lg object-cover" />
              )}
              <h3 className="text-sm font-semibold leading-tight">{item.name}</h3>
              {item.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-brand-600">NRS {item.price}</span>
                {item.isAvailable && (
                  <button onClick={() => addToCart(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white text-lg font-bold hover:bg-brand-600 leading-none">
                    +
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white px-4 py-3 shadow-lg">
          <button onClick={() => setShowCart(true)}
            className="flex w-full items-center justify-between rounded-lg bg-brand-500 px-4 py-3 text-white hover:bg-brand-600 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <span className="text-sm font-semibold">{cartCount} items</span>
            </div>
            <span className="text-sm font-bold">NRS {cartTotal} — View Cart</span>
          </button>
        </div>
      )}

      {/* Cart slide-up */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-bold">Your Order</h2>
            <button onClick={() => setShowCart(false)} className="text-2xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {cart.map(item => (
              <div key={item.menuItemId} className="flex items-center justify-between border-b py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">NRS {item.price} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border text-sm">−</button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border text-sm">+</button>
                </div>
                <span className="ml-3 w-16 text-right text-sm font-bold">NRS {item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Subtotal</span><span className="font-bold">NRS {cartTotal}</span>
            </div>
            <button onClick={placeOrder} disabled={placingOrder || cart.length === 0}
              className="w-full rounded-lg bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">
              {placingOrder ? 'Placing Order...' : `Place Order — NRS ${cartTotal}`}
            </button>
            {lastOrder && !billStatus && (
              <button onClick={requestBill} disabled={requestingBill}
                className="mt-2 w-full rounded-lg border-2 border-brand-500 py-3 text-sm font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-50">
                {requestingBill ? 'Requesting Bill...' : '🧾 Request Bill'}
              </button>
            )}
            {billStatus && (
              <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-center text-sm text-blue-700 font-medium">
                {billStatus === 'bill_requested' && '📋 Bill Requested — Waiting for confirmation'}
                {billStatus === 'unpaid' && '📋 Bill Pending Payment'}
                {billStatus === 'paid' && '✅ Payment Confirmed — Thank you!'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
