import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RenterSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Renter Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your renter preferences, account details, and communication settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Update the information other users see on your account.
            </p>
            <Button asChild variant="outline">
              <Link href="/account/profile">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review alerts and activity from your rentals.
            </p>
            <Button asChild variant="outline">
              <Link href="/account/notifications">View Notifications</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keep renter conversations organized in one place.
            </p>
            <Button asChild variant="outline">
              <Link href="/account/messages">Open Messages</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
