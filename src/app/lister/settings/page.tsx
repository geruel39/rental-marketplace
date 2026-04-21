import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ListerSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Lister Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage the settings that affect your listings, payouts, and verification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Update your public details and avatar.
            </p>
            <Button asChild variant="outline">
              <Link href="/account/profile">Open Profile</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set up payouts and manage how you receive earnings.
            </p>
            <Button asChild>
              <Link href="/lister/settings/payments">Manage Payouts</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review your verification progress before listing new items.
            </p>
            <Button asChild variant="outline">
              <Link href="/account/verify">Open Verification</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
