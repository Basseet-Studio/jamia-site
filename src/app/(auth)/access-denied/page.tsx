"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <div className="w-full max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold">
        {/* TODO(i18n): title */}
        Access denied
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {/* TODO(i18n): body */}
        Your account is signed in, but is not on the administrator list. Ask
        the owner to add you in the Firebase console.
      </p>
      {user?.email ? (
        <p className="mt-2 text-sm">
          {/* TODO(i18n): email label */}
          Signed in as <strong>{user.email}</strong>
        </p>
      ) : null}
      <div className="mt-6 flex justify-center">
        <Button onClick={onSignOut}>
          {/* TODO(i18n): sign out label */}
          Sign out
        </Button>
      </div>
    </div>
  );
}
