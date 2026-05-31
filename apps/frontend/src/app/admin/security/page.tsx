'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function SecurityPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [hasPasskey, setHasPasskey] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    // Check if user has a passkey by trying to get auth options
    if (user) checkPasskeyStatus();
  }, [user, isLoading]);

  async function checkPasskeyStatus() {
    try {
      const res = await apiGet<any>('/api/admin/webauthn/auth-options');
      // If no error about missing credential, they might have one
      setHasPasskey(true);
    } catch { setHasPasskey(false); }
  }

  async function registerPasskey() {
    setLoading(true); setStatus('Generating challenge...');
    try {
      // 1. Get registration options from server
      const optionsRes = await apiGet<any>('/api/admin/webauthn/register-options');
      if (!optionsRes.success || !optionsRes.data) throw new Error('Failed to get options');

      // 2. Create credential in browser (fingerprint/face/PIN prompt)
      setStatus('Waiting for your fingerprint, face, or PIN...');
      const attResp = await startRegistration({ optionsJSON: optionsRes.data });

      // 3. Send attestation to server for verification
      setStatus('Verifying...');
      const verifyRes = await apiPost('/api/admin/webauthn/register', attResp);
      if (verifyRes.success) {
        setHasPasskey(true);
        setStatus('✅ Passkey registered successfully!');
      } else {
        setStatus('❌ Registration failed: ' + (verifyRes.error?.message || 'Unknown error'));
      }
    } catch (err: any) {
      setStatus('❌ ' + (err.message || 'Registration failed'));
    }
    setLoading(false);
  }

  async function testPasskey() {
    setLoading(true); setStatus('Generating challenge...');
    try {
      // 1. Get auth options
      const optionsRes = await apiGet<any>('/api/admin/webauthn/auth-options');
      if (!optionsRes.success || !optionsRes.data) throw new Error('Failed');

      // 2. Get credential from browser
      setStatus('Waiting for your fingerprint, face, or PIN...');
      const authResp = await startAuthentication({ optionsJSON: optionsRes.data });

      // 3. Verify
      setStatus('Verifying...');
      const verifyRes = await apiPost('/api/admin/webauthn/verify', authResp);
      if (verifyRes.success) {
        setStatus('✅ Passkey verified! You are authenticated.');
      } else {
        setStatus('❌ Verification failed');
      }
    } catch (err: any) {
      setStatus('❌ ' + (err.message || 'Verification failed'));
    }
    setLoading(false);
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div className="w-full">
        <h1 className="text-xl sm:text-2xl font-bold">Security</h1>
        <p className="text-xs text-muted-foreground mt-1">Passkey & WebAuthn management</p>

        <div className="mt-6 max-w-lg space-y-4">
          {/* Passkey Status */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Passkey Status</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {hasPasskey ? '✅ A passkey is registered for your account.' : '⚠️ No passkey registered yet.'}
            </p>
          </div>

          {/* Register Passkey */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">{hasPasskey ? 'Re-register Passkey' : 'Register Passkey'}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Use your device&apos;s fingerprint, face, or PIN to secure critical admin actions.
            </p>
            <button onClick={registerPasskey} disabled={loading}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {loading ? 'Processing...' : hasPasskey ? '🔄 Re-register Passkey' : '🔐 Register Passkey'}
            </button>
          </div>

          {/* Test Passkey */}
          {hasPasskey && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Test Passkey</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Verify your passkey is working correctly.
              </p>
              <button onClick={testPasskey} disabled={loading}
                className="mt-3 rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50">
                {loading ? 'Processing...' : '✅ Test Passkey'}
              </button>
            </div>
          )}

          {/* Status message */}
          {status && (
            <div className={`rounded-lg p-3 text-sm ${status.startsWith('✅') ? 'bg-green-50 text-green-700' : status.startsWith('❌') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
              {status}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
