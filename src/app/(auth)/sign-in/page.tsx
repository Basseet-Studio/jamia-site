import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function SignInPage() {
  return (
    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
      <h1 className="text-xl font-semibold">
        {/* TODO(i18n): title */}
        Veeramangalam Juma Masjid
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {/* TODO(i18n): subtitle */}
        Sign in with your administrator Google account to continue.
      </p>
      <div className="mt-6 flex justify-center">
        <GoogleSignInButton />
      </div>
    </div>
  );
}
