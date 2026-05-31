'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

const PAYMENT_MEDIUMS = ['Cash', 'Card', 'QR', 'Manual QR Transfer', 'Bank Transfer', 'Other'];

export default function BillingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [tab, setTab] = useState('bill_requested');
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMedium, setPaymentMedium] = useState('Cash');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editVat, setEditVat] = useState(0);
  const [editSc, setEditSc] = useState(0);
  const [editTax, setEditTax] = useState(0);

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const b = await apiGet<any[]>(`/api/restaurants/${r.data.id}/bills?status=${tab}`);
      if (b.success && b.data) setBills(b.data);
    }
  }, [tab]);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading, tab]);

  // Poll bills every 12s for real-time updates
  useEffect(() => { if (!restaurant) return; const i = setInterval(() => load(), 12000); return () => clearInterval(i); }, [restaurant, tab, load]);

  async function openBill(billId: string) {
    if (!restaurant) return;
    const res = await apiGet<any>(`/api/restaurants/${restaurant.id}/bills/${billId}`);
    if (res.success && res.data) {
      setSelectedBill(res.data);
      setEditDiscount(res.data.discount);
      setEditVat(res.data.vat);
      setEditSc(res.data.serviceCharge);
      setEditTax(res.data.tax);
    }
  }

  async function saveAdjustments() {
    if (!restaurant || !selectedBill) return;
    await apiPatch(`/api/restaurants/${restaurant.id}/bills/${selectedBill.id}`, {
      discount: editDiscount, vat: editVat, serviceCharge: editSc, tax: editTax,
    });
    openBill(selectedBill.id);
  }

  async function markPaid() {
    if (!restaurant || !selectedBill) return;
    await apiPost(`/api/restaurants/${restaurant.id}/bills/${selectedBill.id}/mark-paid`, { paymentMedium });
    setShowPayModal(false);
    setSelectedBill(null);
    load();
  }

  async function markUnpaid(billId: string) {
    if (!restaurant) return;
    await apiPost(`/api/restaurants/${restaurant.id}/bills/${billId}/mark-unpaid`);
    load();
  }

  async function cancelBill(billId: string) {
    if (!restaurant || !confirm('Cancel this bill?')) return;
    await apiPost(`/api/restaurants/${restaurant.id}/bills/${billId}/cancel`);
    load();
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>

        {/* Tabs */}
        <div className="mt-4 flex gap-2 border-b">
          {[
            { key: 'bill_requested', label: 'Active Requests' },
            { key: 'unpaid', label: 'Unpaid' },
            { key: 'paid', label: 'Paid' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedBill(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Bill list */}
        {!selectedBill ? (
          <div className="mt-4 space-y-3">
            {bills.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No {tab.replace('_', ' ')} bills.</p>
            ) : bills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => openBill(bill.id)}>
                <div>
                  <p className="font-semibold text-sm">Table {bill.table?.tableNumber ?? '?'}</p>
                  <p className="text-xs text-muted-foreground">Total: NRS {bill.total?.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(bill.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    bill.status === 'paid' ? 'bg-green-100 text-green-700' :
                    bill.status === 'bill_requested' ? 'bg-blue-100 text-blue-700' :
                    bill.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{bill.status.replace('_', ' ')}</span>
                  <span className="text-muted-foreground">→</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Bill detail */
          <div className="mt-4">
            <button onClick={() => setSelectedBill(null)} className="text-sm text-brand-500 hover:underline mb-4">&larr; Back</button>
            <div className="rounded-xl border bg-card p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold">Bill for Table {selectedBill.table?.tableNumber}</h2>
                  <p className="text-sm text-muted-foreground">{new Date(selectedBill.createdAt).toLocaleString()}</p>
                  {selectedBill.customerName && <p className="text-sm font-medium mt-1">👤 {selectedBill.customerName}{selectedBill.customerPhone ? ` · 📞 ${selectedBill.customerPhone}` : ''}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedBill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{selectedBill.status.replace('_', ' ')}</span>
              </div>

              {/* Order items */}
              <div className="mt-4 space-y-2">
                {selectedBill.orders?.map((o: any) => o.items?.map((i: any) => (
                  <div key={i.id} className="flex justify-between text-sm border-b py-1">
                    <span>{i.quantity}x {i.menuItemName}</span>
                    <span>NRS {i.totalPrice?.toFixed(2)}</span>
                  </div>
                )))}
              </div>

              {/* Adjustments — only for non-paid bills */}
              {selectedBill.status !== 'paid' && selectedBill.status !== 'cancelled' ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><label className="text-xs">Subtotal</label><p className="font-bold">NRS {selectedBill.subtotal?.toFixed(2)}</p></div>
                  <div><label className="text-xs">Discount (NRS)</label>
                    <input type="number" value={editDiscount} onChange={e => setEditDiscount(Number(e.target.value))}
                      className="w-full rounded border px-1 py-0.5 text-xs" /></div>
                  <div><label className="text-xs">VAT ({restaurant?.vatPercentage ?? 13}%)</label>
                    <input type="number" value={editVat} onChange={e => setEditVat(Number(e.target.value))}
                      className="w-full rounded border px-1 py-0.5 text-xs" /></div>
                  <div><label className="text-xs">Service Charge ({restaurant?.serviceChargePercentage ?? 10}%)</label>
                    <input type="number" value={editSc} onChange={e => setEditSc(Number(e.target.value))}
                      className="w-full rounded border px-1 py-0.5 text-xs" /></div>
                  <div><label className="text-xs">Additional Tax ({restaurant?.taxPercentage ?? 0}%)</label>
                    <input type="number" value={editTax} onChange={e => setEditTax(Number(e.target.value))}
                      className="w-full rounded border px-1 py-0.5 text-xs" /></div>
                  <div><label className="text-xs">Total</label>
                    <p className="text-lg font-bold text-brand-600">
                      NRS {(selectedBill.subtotal - editDiscount + editVat + editSc + editTax).toFixed(2)}</p></div>
                  <div className="col-span-2 mt-2">
                    <button onClick={saveAdjustments} className="rounded bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-200">Update Adjustments</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Subtotal:</span> NRS {selectedBill.subtotal?.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">Discount:</span> NRS {selectedBill.discount?.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">VAT:</span> NRS {selectedBill.vat?.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">SC:</span> NRS {selectedBill.serviceCharge?.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">Tax:</span> NRS {selectedBill.tax?.toFixed(2)}</div>
                  <div className="font-bold text-lg">Total: NRS {selectedBill.total?.toFixed(2)}</div>
                  {selectedBill.paymentMedium && <div><span className="text-muted-foreground">Paid via:</span> {selectedBill.paymentMedium}</div>}
                </div>
              )}

              {/* Actions */}
              {selectedBill.status === 'bill_requested' && (
                <div className="mt-6 flex gap-3">
                  <button onClick={() => markUnpaid(selectedBill.id)} className="rounded-lg border px-4 py-2 text-sm">Save as Unpaid</button>
                  <button onClick={() => setShowPayModal(true)} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">Mark as Paid</button>
                  <button onClick={() => cancelBill(selectedBill.id)} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">Cancel</button>
                </div>
              )}
              {selectedBill.status === 'unpaid' && (
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowPayModal(true)} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">Mark as Paid</button>
                  <button onClick={() => cancelBill(selectedBill.id)} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">Cancel</button>
                </div>
              )}
              {selectedBill.paymentMedium && (
                <p className="mt-2 text-sm text-muted-foreground">Paid via {selectedBill.paymentMedium} at {new Date(selectedBill.paidAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Payment modal */}
        {showPayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPayModal(false)}>
            <div className="w-full max-w-xs rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold">Mark as Paid</h2>
              <label className="block mt-3 text-sm font-medium">Payment Medium</label>
              <select value={paymentMedium} onChange={e => setPaymentMedium(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {PAYMENT_MEDIUMS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setShowPayModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button onClick={markPaid} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">Confirm Payment</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
