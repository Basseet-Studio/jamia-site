"use client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

export function SignOutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  const t = useT();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        router.replace("/sign-in");
      }}
    >
      {t("common.signOut")}
    </Button>
  );
}
