'use client';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
export default function GovernancePage() {
  return <DashboardLayout variant="admin"><div><h1 className="text-2xl font-bold">Governance</h1><p className="mt-2 text-muted-foreground">Coming in Phase 11 — security-critical actions requiring multi-admin approval.</p></div></DashboardLayout>;
}
