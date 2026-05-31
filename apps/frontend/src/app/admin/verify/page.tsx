'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { apiGet, apiPost } from '@/lib/api';
import { startAuthentication } from '@simplewebauthn/browser';

export default function AdminVerifyPage() {
  const { user, isLoading, role, signOut } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/admin/login'); return; }
    if (!isLoading && role && role !== 'super_admin') { router.push('/admin/login'); return; }
    if (!isLoading && user && role === 'super_admin') {
      // Start passkey verification automatically
      verifyPasskey();
    }
  }, [user, isLoading, role]);

  async function verifyPasskey() {
    setVerifying(true);
    setStatus('Requesting passkey verification...');
    try {
      const optRes = await apiGet<any>('/api/admin/webauthn/auth-options');
      if (optRes.error?.code === 'NO_CREDENTIAL') {
        setStatus('no_passkey');
        setVerifying(false);
        return;
      }
      if (!optRes.success || !optRes.data) throw new Error('Failed');

      setStatus('Waiting for your fingerprint, Face ID, or PIN...');
      const authResp = await startAuthentication({ optionsJSON: optRes.data });

      setStatus('Verifying...');
      const verifyRes = await apiPost('/api/admin/webauthn/verify', authResp);
      if (verifyRes.success) {
        setStatus('verified');
        router.push('/admin');
      } else {
        setStatus('failed');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setStatus('cancelled');
      else setStatus('failed');
    }
    setVerifying(false);
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 shadow-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white text-xl font-bold">Z</div>
        <h1 className="mt-4 text-2xl font-bold text-white">Passkey Required</h1>
        <p className="mt-2 text-sm text-gray-400">Super admin access requires passkey verification.</p>

        {status === 'no_passkey' && (
          <div className="mt-6">
            <p className="text-yellow-400 text-sm mb-4">⚠️ No passkey registered for your account. You must register a passkey first before accessing the admin dashboard.</p>
            <button onClick={() => router.push('/admin/security')} className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Go to Security Settings
            </button>
          </div>
        )}

        {(status === 'failed' || status === 'cancelled') && (
          <div className="mt-6">
            <p className="text-red-400 text-sm mb-4">
              {status === 'cancelled' ? '❌ Passkey verification was cancelled.' : '❌ Passkey verification failed.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={verifyPasskey} disabled={verifying} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                Try Again
              </button>
              <button onClick={() => { signOut(); router.push('/admin/login'); }} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                Sign Out
              </button>
            </div>
          </div>
        )}

        {status !== 'no_passkey' && status !== 'failed' && status !== 'cancelled' && (
          <div className="mt-6">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-400">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
