'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';

// Wrapper that ensures super admins have verified their passkey this session
export function RequirePasskey({ children }: { children: ReactNode }) {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/admin/login'); return; }
    if (role !== 'super_admin') { router.push('/admin/login'); return; }

    // Check if passkey was verified this session
    const verified = sessionStorage.getItem('zenthorax-passkey-verified');
    if (verified === '1') {
      setChecked(true);
    } else {
      router.push('/admin/verify');
    }
  }, [user, isLoading, role]);

  if (!checked) return null;
  return <>{children}</>;
}
