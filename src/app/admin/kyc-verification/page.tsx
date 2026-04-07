import { ShieldCheck } from "lucide-react";

import { getPendingKYCVerifications } from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { KycVerificationList } from "@/components/admin/kyc-verification-list";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";

export default async function AdminKycVerificationPage() {
  const { users, count } = await getPendingKYCVerifications();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Review pending bank payout identity checks and approve or reject submitted KYC documents."
        title="KYC Verification"
      />

      {count === 0 ? (
        <EmptyState
          description="No pending KYC verifications"
          icon={ShieldCheck}
          title="All caught up"
        />
      ) : (
        <KycVerificationList users={users} />
      )}
    </div>
  );
}
