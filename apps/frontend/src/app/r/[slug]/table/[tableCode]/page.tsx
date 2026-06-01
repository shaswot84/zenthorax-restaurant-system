'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [billStatus, setBillStatus] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [showBillPanel, setShowBillPanel] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [sessionOrders, setSessionOrders] = useState<any[]>([]);
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

  async function loadSessionOrders() {
    if (!tableData) return;
    const res = await fetch(`${API}/api/sessions/${tableData.sessionToken}/orders`);
    const json = await res.json();
    if (json.success && json.data) setSessionOrders(json.data.filter((o: any) => o.status !== 'cancelled'));
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/tables/validate?slug=${params.slug}&code=${params.tableCode}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTableData(json.data);
        const menuRes = await fetch(`${API}/api/restaurants/${json.data.restaurantId}/menu`);
        const menuJson = await menuRes.json();
        if (menuJson.success && menuJson.data) setCategories(menuJson.data);
        setStatus('valid');
        // Clear any stale state from a previous customer session
        setCart([]); setBillStatus(null); setBillId(null); setSessionOrders([]);
        localStorage.removeItem('zenthorax-session');
        // Load existing session orders (should be empty for a fresh session)
        const ordRes = await fetch(`${API}/api/sessions/${json.data.sessionToken}/orders`);
        const ordJson = await ordRes.json();
        if (ordJson.success && ordJson.data) setSessionOrders(ordJson.data.filter((o: any) => o.status !== 'cancelled'));
      } else { setError(json.error?.message ?? 'Invalid QR code'); setStatus('invalid'); }
    } catch { setError('Unable to connect.'); setStatus('invalid'); }
  }, [params.slug, params.tableCode]);

  useEffect(() => { load(); }, [load]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const hasOrders = sessionOrders.length > 0;
  const orderedTotal = sessionOrders.reduce((s, o) => s + (o.items || []).reduce((si: number, i: any) => si + i.totalPrice, 0), 0);
  const orderedCount = sessionOrders.reduce((s, o) => s + (o.items || []).reduce((si: number, i: any) => si + i.quantity, 0), 0);

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(i => i.menuItemId === item.id);
      if (ex) return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.menuItemId !== id));
    else setCart(prev => prev.map(i => i.menuItemId === id ? { ...i, quantity: qty } : i));
  }

  async function placeOrder() {
    if (!tableData || cart.length === 0) return;
    setPlacingOrder(true);
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: tableData.sessionToken, items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })) }),
      });
      const json = await res.json();
      if (json.success) {
        setCart([]); setShowCart(false);
        await loadSessionOrders();
      }
    } catch {}
    setPlacingOrder(false);
  }

  async function requestBill() {
    if (!tableData || !custName.trim()) return;
    setRequestingBill(true);
    try {
      const res = await fetch(`${API}/api/bills/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: tableData.sessionToken, customerName: custName.trim(), customerPhone: custPhone.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) { setBillId(json.data.id); setBillStatus(json.data.status); setShowBillPanel(false); }
    } catch {}
    setRequestingBill(false);
  }

  // Persist session data so refresh doesn't lose state
  useEffect(() => {
    if (tableData) {
      localStorage.setItem('zenthorax-session', JSON.stringify({ token: tableData.sessionToken, billId, billStatus }));
    }
  }, [tableData, billId, billStatus]);

  // Restore session + bill status on mount
  useEffect(() => {
    const saved = localStorage.getItem('zenthorax-session');
    if (saved && !billStatus) {
      try {
        const { billId: sBillId, billStatus: sStatus, token } = JSON.parse(saved);
        if (sBillId && sStatus) {
          setBillId(sBillId);
          setBillStatus(sStatus);
          // Fetch current bill status from API
          fetch(`${API}/api/bills/${token}/public`)
            .then(r => r.json())
            .then(json => { if (json.success) setBillStatus(json.data.status); });
        }
      } catch {}
    }
  }, []);

  // Poll bill status — reliable fallback (RLS blocks Realtime for anon users)
  const billStatusRef = useRef(billStatus);
  billStatusRef.current = billStatus;
  useEffect(() => {
    if (!billId || billStatus === 'paid' || !tableData) return;
    const interval = setInterval(async () => {
      if (billStatusRef.current === 'paid') { clearInterval(interval); return; }
      try {
        const res = await fetch(`${API}/api/bills/${tableData.sessionToken}/public`);
        const json = await res.json();
        if (json.success && json.data && json.data.status === 'paid') {
          setBillStatus('paid');
          clearInterval(interval);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [billId, tableData]);

  const filteredItems = activeCat === 'all' ? categories.flatMap(c => c.items) : (categories.find(c => c.id === activeCat)?.items ?? []);

  if (status === 'loading') return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;
  if (status === 'invalid') return <div className="flex min-h-screen items-center justify-center p-4"><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100"><span className="text-2xl">⚠️</span></div><h1 className="mt-4 text-xl font-bold">QR Code Not Valid</h1><p className="mt-2 text-muted-foreground">{error}</p></div></div>;

  const showBottomBar = cart.length > 0 || (hasOrders && !billStatus) || billStatus;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{tableData?.restaurantName}</h1>
            <p className="text-xs text-muted-foreground">Table: {tableData?.tableNumber}</p>
          </div>
          {/* Bill Download — top right, always visible, disabled until paid */}
          <a
            href={billStatus === 'paid' ? `/bill/${tableData?.sessionToken}` : undefined}
            target={billStatus === 'paid' ? '_blank' : undefined}
            rel={billStatus === 'paid' ? 'noopener' : undefined}
            onClick={e => { if (billStatus !== 'paid') e.preventDefault(); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              billStatus === 'paid'
                ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
            title={billStatus === 'paid' ? 'Download your bill' : 'Bill will be available after payment'}
          >
            📥 Download Bill
          </a>
        </div>
      </header>

      <div className="sticky top-[57px] z-10 border-b bg-white px-2 py-2 overflow-x-auto">
        <div className="flex gap-1.5 whitespace-nowrap">
          <button onClick={() => setActiveCat('all')} className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeCat === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeCat === c.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{c.name}</button>
          ))}
        </div>
      </div>

      <main className={`p-3 ${showBottomBar ? 'pb-24' : ''}`}>
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.length === 0 ? (
            <p className="col-span-2 py-12 text-center text-sm text-muted-foreground">No items in this category.</p>
          ) : filteredItems.map(item => (
            <div key={item.id} className={`rounded-xl border bg-white p-3 shadow-sm ${!item.isAvailable ? 'opacity-40' : ''}`}>
              {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="mb-2 h-28 w-full rounded-lg object-cover" />}
              <h3 className="text-sm font-semibold leading-tight">{item.name}</h3>
              {item.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-brand-600">NRS {item.price}</span>
                {item.isAvailable && (
                  <button onClick={() => addToCart(item)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white text-lg font-bold hover:bg-brand-600 leading-none">+</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom bar */}
      {showBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white px-4 py-3 shadow-lg space-y-2">
          {/* Bill status */}
          {billStatus && (
            <div className={`rounded-lg p-3 text-center text-sm font-medium ${billStatus === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
              {billStatus === 'bill_requested' && '📋 Bill Requested — Waiting for restaurant confirmation'}
              {billStatus === 'unpaid' && '📋 Bill Pending Payment'}
              {billStatus === 'paid' && (
                <p className="font-bold">✅ Payment Confirmed — Thank you!</p>
              )}
            </div>
          )}

          {/* No bill yet — show cart + request bill */}
          {!billStatus && (
            <div className="flex gap-2">
              {cart.length > 0 && (
                <button onClick={() => setShowCart(true)} className="flex-1 flex items-center justify-between rounded-lg bg-brand-500 px-4 py-3 text-white hover:bg-brand-600">
                  <span className="flex items-center gap-2"><span>🛒</span><span className="text-sm font-semibold">{cartCount} items</span></span>
                  <span className="text-sm font-bold">NRS {cartTotal}</span>
                </button>
              )}
              {hasOrders && (
                <button onClick={() => { setShowBillPanel(true); setCustName(''); setCustPhone(''); }}
                  className={`${cart.length > 0 ? '' : 'flex-1'} rounded-lg border-2 border-brand-500 px-4 py-3 text-sm font-bold text-brand-600 hover:bg-brand-50`}>
                  🧾 Request Bill
                </button>
              )}
            </div>
          )}
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
                <div className="flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">NRS {item.price} each</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border text-sm">−</button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border text-sm">+</button>
                </div>
                <span className="ml-3 w-16 text-right text-sm font-bold">NRS {item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t p-4">
            <div className="flex justify-between text-sm mb-2"><span>Subtotal</span><span className="font-bold">NRS {cartTotal}</span></div>
            <button onClick={placeOrder} disabled={placingOrder || cart.length === 0}
              className="w-full rounded-lg bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">
              {placingOrder ? 'Placing Order...' : `Confirm Order — NRS ${cartTotal}`}
            </button>
          </div>
        </div>
      )}

      {/* Request Bill panel */}
      {showBillPanel && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-bold">Request Bill</h2>
            <button onClick={() => setShowBillPanel(false)} className="text-2xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground mb-3">All items ordered in this session:</p>
            <div className="space-y-2 mb-4">
              {sessionOrders.map((o: any) => o.items.map((i: any) => (
                <div key={i.id} className="flex justify-between text-sm border-b pb-1">
                  <span>{i.quantity}x {i.menuItemName}</span>
                  <span className="font-medium">NRS {i.totalPrice.toFixed(2)}</span>
                </div>
              )))}
              <div className="flex justify-between text-sm font-bold pt-2 border-t-2">
                <span>Total</span><span>NRS {orderedTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <input type="text" value={custName} onChange={e => setCustName(e.target.value)}
                placeholder="Your name * (required)" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input type="text" value={custPhone} onChange={e => setCustPhone(e.target.value)}
                placeholder="Phone number (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="border-t p-4">
            <button onClick={requestBill} disabled={requestingBill || !custName.trim()}
              className="w-full rounded-lg bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">
              {requestingBill ? 'Sending...' : 'Send Bill Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
