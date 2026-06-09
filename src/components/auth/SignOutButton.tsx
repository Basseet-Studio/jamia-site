"use client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        router.replace("/sign-in");
      }}
    >
      Sign out
    </Button>
  );
}
