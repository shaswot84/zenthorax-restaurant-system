'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function SecurityPage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [hasPasskey, setHasPasskey] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [notAdmin, setNotAdmin] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/admin/login'); return; }
    if (role && role !== 'super_admin') { setNotAdmin(true); return; }
    if (user) checkPasskeyStatus();
  }, [user, isLoading, role]);

  async function checkPasskeyStatus() {
    try {
      const res = await apiGet<any>('/api/admin/webauthn/auth-options');
      if (res.success || res.error?.code !== 'NO_CREDENTIAL') setHasPasskey(true);
      else setHasPasskey(false);
    } catch { setHasPasskey(false); }
  }

  async function registerPasskey() {
    setLoading(true); setStatus('Requesting registration challenge...');
    try {
      const optRes = await apiGet<any>('/api/admin/webauthn/register-options');
      if (!optRes.success || !optRes.data) throw new Error(optRes.error?.message || 'Failed to get options');

      setStatus('Waiting for your device biometric/PIN prompt...');
      const attResp = await startRegistration({ optionsJSON: optRes.data });

      setStatus('Verifying with server...');
      const verifyRes = await apiPost('/api/admin/webauthn/register', attResp);
      if (verifyRes.success) {
        setHasPasskey(true);
        setStatus('✅ Passkey registered successfully!');
      } else {
        setStatus('❌ ' + (verifyRes.error?.message || 'Registration failed'));
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setStatus('❌ Operation cancelled or timed out');
      else setStatus('❌ ' + (err.message || 'Registration failed'));
    }
    setLoading(false);
  }

  async function testPasskey() {
    setLoading(true); setStatus('Requesting authentication challenge...');
    try {
      const optRes = await apiGet<any>('/api/admin/webauthn/auth-options');
      if (!optRes.success || !optRes.data) throw new Error('Failed');

      setStatus('Waiting for your device biometric/PIN prompt...');
      const authResp = await startAuthentication({ optionsJSON: optRes.data });

      setStatus('Verifying...');
      const verifyRes = await apiPost('/api/admin/webauthn/verify', authResp);
      if (verifyRes.success) setStatus('✅ Passkey verified! You are authenticated.');
      else setStatus('❌ Verification failed');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setStatus('❌ Operation cancelled or timed out');
      else setStatus('❌ ' + (err.message || 'Verification failed'));
    }
    setLoading(false);
  }

  if (isLoading) {
    return <DashboardLayout variant="admin"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></DashboardLayout>;
  }

  if (!user) return null;

  if (notAdmin) {
    return (
      <DashboardLayout variant="admin">
        <div className="w-full">
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center">
            <p className="text-lg font-bold text-red-700">Access Denied</p>
            <p className="text-sm text-red-600 mt-1">Your account ({user.email}) does not have super admin privileges.</p>
            <p className="text-xs text-red-500 mt-3">
              To grant super admin access, run this SQL in Supabase:<br/>
              <code className="bg-red-100 px-1 rounded">UPDATE public.users SET role = &apos;super_admin&apos; WHERE email = &apos;{user.email}&apos;;</code>
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="admin">
      <div className="w-full">
        <h1 className="text-xl sm:text-2xl font-bold">Security</h1>
        <p className="text-xs text-muted-foreground mt-1">Passkey & WebAuthn for critical admin actions</p>

        <div className="mt-6 max-w-lg space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Account</h2>
            <p className="text-xs text-muted-foreground mt-1">{user.email} — Role: {role}</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Passkey Status</h2>
            <p className="text-xs mt-1">
              {hasPasskey
                ? <span className="text-green-600 font-medium">✅ A passkey is registered for your account.</span>
                : <span className="text-yellow-600 font-medium">⚠️ No passkey registered yet.</span>
              }
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">{hasPasskey ? 'Re-register Passkey' : 'Register Passkey'}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Use fingerprint, Face ID, or device PIN to authorize critical actions.
            </p>
            <button onClick={registerPasskey} disabled={loading}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {loading ? 'Processing...' : '🔐 Register Passkey'}
            </button>
          </div>

          {hasPasskey && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Test Passkey</h2>
              <button onClick={testPasskey} disabled={loading}
                className="mt-3 rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50">
                ✅ Test Passkey
              </button>
            </div>
          )}

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
