"use client";
/**
 * AppShell — global nav: Dashboard / Households / Expenses / Recurring / Settings,
 * admin identity, sign-out.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, signOut } = useAuth();
  const { isFullAdmin } = usePermissions();
  const t = useT();

  // Clerks only need Households (to add HH/families). Full admins get everything.
  const navItems: { href: string; labelKey: string }[] = isFullAdmin
    ? [
        { href: "/dashboard", labelKey: "nav.dashboard" },
        { href: "/households", labelKey: "nav.households" },
        { href: "/contributions", labelKey: "nav.contributions" },
        { href: "/expenses", labelKey: "nav.expenses" },
        { href: "/recurring", labelKey: "nav.recurring" },
        { href: "/calendar", labelKey: "nav.calendar" },
        { href: "/settings", labelKey: "nav.settings" },
        { href: "/debug", labelKey: "nav.debug" },
      ]
    : [
        { href: "/households", labelKey: "nav.households" },
        { href: "/settings", labelKey: "nav.settings" },
      ];

  // Household detail family rows need more horizontal room for action buttons.
  const wideContent = pathname?.startsWith("/households") ?? false;
  const contentMaxWidth = wideContent ? "max-w-screen-2xl" : "max-w-6xl";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div
          className={cn(
            "mx-auto flex items-center justify-between px-4 py-3",
            contentMaxWidth,
          )}
        >
          <div className="flex items-center gap-6">
            <Link
              href={isFullAdmin ? "/dashboard" : "/households"}
              className="text-base font-semibold"
            >
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
                {admin.role === "clerk" ? " · clerk" : ""}
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
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6",
          contentMaxWidth,
        )}
      >
        {children}
      </main>
    </div>
  );
}
