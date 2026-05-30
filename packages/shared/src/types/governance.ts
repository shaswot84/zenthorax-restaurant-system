export type GovernanceActionType =
  | 'hard_delete_restaurant'
  | 'add_super_admin'
  | 'remove_super_admin'
  | 'revoke_passkey'
  | 'change_security_policy'
  | 'change_audit_retention'
  | 'trigger_large_purge';

export type GovernanceVoteType = 'approve' | 'reject';

export interface GovernanceProposal {
  id: string;
  proposerId: string;
  actionType: GovernanceActionType;
  targetId: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  requiredApprovals: number;
  cooldownMinutes: number;
  cooldownEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GovernanceVote {
  id: string;
  proposalId: string;
  voterId: string;
  vote: GovernanceVoteType;
  reason: string | null;
  votedAt: Date;
}
