"use client";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { AdminManagement } from "@/components/settings/AdminManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/hooks/useAuth";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.heading")}</h1>
      <SettingsForm />
      <LanguageSwitcher />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.account")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AccountInfo />
          <SignOutButton />
        </CardContent>
      </Card>
      <AdminManagement />
    </div>
  );
}

function AccountInfo() {
  const { admin, user } = useAuth();
  const t = useT();
  const dash = t("common.dash");
  return (
    <div className="text-sm">
      <p>
        <span className="text-muted-foreground">
          {t("settings.accountName")}
        </span>{" "}
        {admin?.displayName ?? user?.displayName ?? dash}
      </p>
      <p>
        <span className="text-muted-foreground">
          {t("settings.accountEmail")}
        </span>{" "}
        {admin?.email ?? user?.email ?? dash}
      </p>
      <p>
        <span className="text-muted-foreground">
          {t("settings.accountRole")}
        </span>{" "}
        {admin?.role ?? dash}
      </p>
    </div>
  );
}
