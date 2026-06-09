"use client";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/hooks/useAuth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm />
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AccountInfo />
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}

function AccountInfo() {
  const { admin, user } = useAuth();
  return (
    <div className="text-sm">
      <p>
        <span className="text-muted-foreground">Name:</span>{" "}
        {admin?.displayName ?? user?.displayName ?? "—"}
      </p>
      <p>
        <span className="text-muted-foreground">Email:</span>{" "}
        {admin?.email ?? user?.email ?? "—"}
      </p>
      <p>
        <span className="text-muted-foreground">Role:</span>{" "}
        {admin?.role ?? "—"}
      </p>
    </div>
  );
}
