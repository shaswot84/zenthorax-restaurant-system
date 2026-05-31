'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface BillData {
  id: string; restaurantName: string; table?: { tableNumber: string };
  customerName: string | null; customerPhone: string | null;
  subtotal: number; discount: number; vat: number; serviceCharge: number; tax: number; total: number;
  status: string; paymentMedium: string | null; paidAt: string | null;
  createdAt: string;
  orders: { items: { menuItemName: string; quantity: number; totalPrice: number }[] }[];
}

export default function BillPage() {
  const params = useParams<{ token: string }>();
  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

  useEffect(() => {
    fetch(`${API}/api/bills/${params.token}/public`)
      .then(r => r.json())
      .then(json => { if (json.success) setBill(json.data); })
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;
  if (!bill) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Bill not found.</p></div>;

  const items = bill.orders?.flatMap(o => o.items) ?? [];

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:py-0 print:bg-white">
      <div className="mx-auto max-w-md bg-white rounded-xl shadow-sm print:shadow-none print:rounded-none p-6 print:p-0">
        {/* Print button — hidden when printing */}
        <div className="print:hidden mb-4 flex gap-2">
          <button onClick={() => window.print()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">🖨️ Print Bill</button>
          <button onClick={() => window.history.back()} className="rounded-lg border px-4 py-2 text-sm">Back</button>
        </div>

        {/* Bill header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{bill.restaurantName}</h1>
              <p className="text-sm text-muted-foreground">Table: {bill.table?.tableNumber ?? '?'}</p>
            </div>
            <div className="text-right">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {bill.status === 'paid' ? 'PAID' : bill.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Customer info */}
        {bill.customerName && (
          <div className="mb-4 text-sm">
            <p><span className="text-muted-foreground">Customer:</span> {bill.customerName}</p>
            {bill.customerPhone && <p><span className="text-muted-foreground">Phone:</span> {bill.customerPhone}</p>}
          </div>
        )}

        {/* Items */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-center font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{item.menuItemName}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">NRS {item.totalPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>NRS {bill.subtotal.toFixed(2)}</span></div>
          {bill.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">- NRS {bill.discount.toFixed(2)}</span></div>}
          {bill.vat > 0 && <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>NRS {bill.vat.toFixed(2)}</span></div>}
          {bill.serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>NRS {bill.serviceCharge.toFixed(2)}</span></div>}
          {bill.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Additional Tax</span><span>NRS {bill.tax.toFixed(2)}</span></div>}
          <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
            <span>Total</span><span>NRS {bill.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment info */}
        {bill.status === 'paid' && (
          <div className="mt-4 border-t pt-3 text-sm text-green-700">
            <p>✅ Paid via {bill.paymentMedium} on {bill.paidAt ? new Date(bill.paidAt).toLocaleString() : 'N/A'}</p>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>Generated on {new Date(bill.createdAt).toLocaleString()}</p>
          <p className="mt-1">Thank you for dining with us!</p>
        </div>
      </div>
    </div>
  );
}
