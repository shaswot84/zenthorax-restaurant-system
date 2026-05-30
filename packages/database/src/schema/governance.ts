import { pgTable, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const governanceActionEnum = pgEnum('governance_action_type', [
  'hard_delete_restaurant',
  'add_super_admin',
  'remove_super_admin',
  'revoke_passkey',
  'change_security_policy',
  'change_audit_retention',
  'trigger_large_purge',
]);

export const governanceProposalStatusEnum = pgEnum('governance_proposal_status', [
  'pending',
  'approved',
  'rejected',
  'executed',
  'expired',
]);

export const governanceVoteTypeEnum = pgEnum('governance_vote_type', ['approve', 'reject']);

export const governanceProposals = pgTable('governance_proposals', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  proposerId: text('proposer_id')
    .notNull()
    .references(() => users.id),
  actionType: governanceActionEnum('action_type').notNull(),
  targetId: text('target_id'),
  reason: text('reason').notNull(),
  status: governanceProposalStatusEnum('status').notNull().default('pending'),
  requiredApprovals: integer('required_approvals').notNull().default(2),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
  cooldownEndsAt: timestamp('cooldown_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const governanceVotes = pgTable('governance_votes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  proposalId: text('proposal_id')
    .notNull()
    .references(() => governanceProposals.id, { onDelete: 'cascade' }),
  voterId: text('voter_id')
    .notNull()
    .references(() => users.id),
  vote: governanceVoteTypeEnum('vote').notNull(),
  reason: text('reason'),
  votedAt: timestamp('voted_at', { withTimezone: true }).defaultNow().notNull(),
});
