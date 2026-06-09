"use client";
/**
 * AppShell — global nav: Dashboard / Households / Expenses / Recurring / Settings,
 * admin identity, sign-out.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/households", label: "Households" },
  { href: "/expenses", label: "Expenses" },
  { href: "/recurring", label: "Recurring" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-base font-semibold">
              {/* TODO(i18n): brand label */}
              Veeramangalam Juma Masjid
            </Link>
            <nav className="flex items-center gap-2">
              {NAV_ITEMS.map((it) => {
                const active = pathname === it.href || pathname?.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      active
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {/* TODO(i18n): nav label */}
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {admin ? (
              <span className="text-sm text-muted-foreground">
                {/* TODO(i18n): admin identity */}
                {admin.displayName} · {admin.email}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                router.replace("/sign-in");
              }}
            >
              {/* TODO(i18n): sign out label */}
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
