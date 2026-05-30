'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores';

export default function QRMenuPage() {
  const params = useParams<{ slug: string; tableCode: string }>();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    async function validateTable() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tables/validate?slug=${params.slug}&code=${params.tableCode}`,
        );
        const json = await res.json();

        if (json.success && json.data) {
          useSessionStore
            .getState()
            .setSession(json.data.sessionToken, params.tableCode, params.slug);
          setStatus('valid');
        } else {
          setError(json.error?.message ?? 'Invalid QR code');
          setStatus('invalid');
        }
      } catch {
        setError('Unable to connect. Please check your internet connection.');
        setStatus('invalid');
      }
    }
    validateTable();
  }, [params.slug, params.tableCode]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">QR Code Not Valid</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Please ask restaurant staff for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Phase 6: Full menu UI will go here
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Menu</h1>
          <span className="text-sm text-muted-foreground">Table: {params.tableCode.slice(0, 8)}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="rounded-full bg-brand-500 px-4 py-1 text-sm font-medium text-white">
            Dine-in
          </button>
          <button className="rounded-full bg-gray-100 px-4 py-1 text-sm font-medium text-gray-600">
            Takeaway
          </button>
        </div>
      </header>

      <main className="p-4 has-cart-bar">
        <p className="text-center text-muted-foreground py-12">
          Menu items will appear here. (Phase 6)
        </p>
      </main>

      {/* Bottom cart bar placeholder */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">🛒 Cart is empty</span>
          </div>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white" disabled>
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}
