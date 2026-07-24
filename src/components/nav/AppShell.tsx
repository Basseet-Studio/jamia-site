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
import { useT } from "@/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, signOut } = useAuth();
  const t = useT();

  const navItems: { href: string; labelKey: string }[] = [
    { href: "/dashboard", labelKey: "nav.dashboard" },
    { href: "/households", labelKey: "nav.households" },
    { href: "/contributions", labelKey: "nav.contributions" },
    { href: "/expenses", labelKey: "nav.expenses" },
    { href: "/recurring", labelKey: "nav.recurring" },
    { href: "/calendar", labelKey: "nav.calendar" },
    { href: "/settings", labelKey: "nav.settings" },
    { href: "/debug", labelKey: "nav.debug" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-base font-semibold">
              {t("brand.name")}
            </Link>
            <nav className="flex items-center gap-2">
              {navItems.map((it) => {
                const active =
                  pathname === it.href || pathname?.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      active
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {t(it.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {admin ? (
              <span className="text-sm text-muted-foreground">
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
              {t("common.signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
