'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { apiPost } from '@/lib/api';

export default function RoleSelectionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;
  }
  if (!user) { router.push('/login'); return null; }

  async function selectRole(role: string) {
    setSelecting(true);
    if (role === 'kitchen_staff') {
      // Set kitchen staff role — redirect to kitchen dashboard
      router.push('/kitchen');
    } else {
      // Restaurant manager — go to onboarding
      router.push('/onboarding');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center">What brings you to Zenthorax?</h1>
        <p className="mt-2 text-center text-muted-foreground">Choose your role to get started</p>

        <div className="mt-8 space-y-4">
          <button onClick={() => selectRole('restaurant_manager')} disabled={selecting}
            className="w-full rounded-xl border-2 border-brand-200 bg-white p-6 text-left hover:border-brand-500 transition-colors">
            <span className="text-2xl">🏪</span>
            <h3 className="mt-2 text-lg font-bold">I own a restaurant</h3>
            <p className="mt-1 text-sm text-muted-foreground">Set up your menu, tables, QR codes, and start taking orders</p>
          </button>

          <button onClick={() => selectRole('kitchen_staff')} disabled={selecting}
            className="w-full rounded-xl border-2 border-gray-200 bg-white p-6 text-left hover:border-brand-500 transition-colors">
            <span className="text-2xl">👨‍🍳</span>
            <h3 className="mt-2 text-lg font-bold">I work in a kitchen</h3>
            <p className="mt-1 text-sm text-muted-foreground">View incoming orders, update ticket status, and keep things moving</p>
          </button>
        </div>
      </div>
    </div>
  );
}
