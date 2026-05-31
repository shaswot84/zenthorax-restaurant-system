'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost } from '@/lib/api';

const ACTIONS = [
  { value: 'hard_delete_restaurant', label: 'Hard Delete Restaurant' },
  { value: 'add_super_admin', label: 'Add Super Admin' },
  { value: 'remove_super_admin', label: 'Remove Super Admin' },
  { value: 'revoke_passkey', label: 'Revoke Passkey' },
  { value: 'change_security_policy', label: 'Change Security Policy' },
  { value: 'change_audit_retention', label: 'Change Audit Retention' },
];

export default function GovernancePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [proposals, setProposals] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [actionType, setActionType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await apiGet<any[]>('/api/admin/governance/proposals');
    if (res.success && res.data) setProposals(res.data);
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  async function createProposal() {
    if (!actionType || !reason) return;
    await apiPost('/api/admin/governance/proposals', { actionType, targetId: targetId || undefined, reason });
    setShowForm(false); setActionType(''); setTargetId(''); setReason('');
    load();
  }

  async function vote(proposalId: string, v: string) {
    await apiPost(`/api/admin/governance/proposals/${proposalId}/vote`, { vote: v });
    load();
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div className="w-full">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Governance</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Multi-admin approval for critical actions</p>
          </div>
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white">
            + New Proposal
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {proposals.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No governance proposals yet.</div>
          ) : proposals.map(p => (
            <div key={p.id} className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-brand-600">{ACTIONS.find(a => a.value === p.actionType)?.label ?? p.actionType}</span>
                  <p className="text-sm mt-1">{p.reason}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Proposed by {p.proposer?.email} · {new Date(p.createdAt).toLocaleString()}
                    {p.targetId && <> · Target: {p.targetId.slice(0, 8)}...</>}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${
                  p.status === 'approved' ? 'bg-green-100 text-green-700' :
                  p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  p.status === 'executed' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{p.status}</span>
              </div>

              {/* Votes */}
              {p.votes?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.votes.map((v: any) => (
                    <span key={v.id} className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-medium ${
                      v.vote === 'approve' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`} title={v.voter?.email}>
                      {v.voter?.email?.split('@')[0]} → {v.vote}
                    </span>
                  ))}
                </div>
              )}

              {/* Vote buttons */}
              {p.status === 'pending' && p.proposerId !== user?.id && !p.votes?.some((v: any) => v.voterId === user?.id) && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => vote(p.id, 'approve')} className="rounded bg-green-500 px-3 py-1 text-xs font-semibold text-white hover:bg-green-600">
                    Approve ({p.votes?.filter((v: any) => v.vote === 'approve').length ?? 0}/{p.requiredApprovals})
                  </button>
                  <button onClick={() => vote(p.id, 'reject')} className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create Proposal Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl m-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold">New Governance Proposal</h2>
              <div className="mt-3 space-y-3">
                <select value={actionType} onChange={e => setActionType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">Select action...</option>
                  {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <input type="text" value={targetId} onChange={e => setTargetId(e.target.value)}
                  placeholder="Target ID (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Reason for this action (required)" rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button onClick={createProposal} disabled={!actionType || !reason}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                  Create Proposal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
