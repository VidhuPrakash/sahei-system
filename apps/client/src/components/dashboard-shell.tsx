"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Settings, PhoneCall, CalendarCheck, BarChart3 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MobileNav,
  MobileNavContent,
  MobileNavTitle,
  MobileNavTrigger,
  SectionNav,
  SectionNavItem,
} from "@sahei/ui";

import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/dashboard/calls", label: "Calls & Transcripts", icon: PhoneCall },
  { href: "/dashboard/bookings", label: "Bookings & Calendar", icon: CalendarCheck },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

const PAGE_TITLES: Record<string, string> = {
  ...Object.fromEntries(NAV_ITEMS.map((item) => [item.href, item.label])),
  "/dashboard/settings": "Manage Organization",
};

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-shell-muted-foreground">
      {children}
    </p>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <SectionNavItem key={item.href} asChild active={pathname === item.href} onClick={onNavigate}>
          <Link href={item.href}>
            <item.icon className="size-4" />
            {item.label}
          </Link>
        </SectionNavItem>
      ))}
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { data: organization } = authClient.useActiveOrganization();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pageTitle = PAGE_TITLES[pathname];

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-shell-border bg-shell-background px-4 py-3 text-shell-foreground md:px-6">
        <div className="flex items-center gap-3">
          <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <MobileNavTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-shell-foreground hover:bg-shell-accent hover:text-shell-foreground md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </MobileNavTrigger>
            <MobileNavContent>
              <div className="flex items-center justify-center self-start rounded-md bg-white px-2 py-1">
                <Image src="/logo.png" alt="SaHei" width={96} height={96} className="h-7 w-auto" priority />
              </div>
              <MobileNavTitle className="sr-only">SaHei navigation</MobileNavTitle>
              <SectionNav>
                <NavSectionLabel>Workspace</NavSectionLabel>
                <NavLinks onNavigate={() => setMobileNavOpen(false)} />
              </SectionNav>
            </MobileNavContent>
          </MobileNav>
          <div className="hidden items-center justify-center rounded-md bg-white px-2 py-1 md:flex">
            <Image src="/logo.png" alt="SaHei" width={96} height={96} className="h-8 w-auto" priority />
          </div>
          {organization && (
            <>
              <span aria-hidden className="hidden h-6 w-px bg-shell-border sm:block" />
              <span className="hidden text-sm text-shell-muted-foreground sm:inline">{organization.name}</span>
            </>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full bg-shell-accent text-sm font-semibold text-shell-foreground outline-none transition-colors hover:bg-shell-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              {getInitials(session?.user.name, session?.user.email)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {organization && <DropdownMenuLabel>{organization.name}</DropdownMenuLabel>}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <Settings className="size-4" />
                Manage organization
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-shell-border bg-shell-background p-4 md:block">
          <SectionNav>
            <NavSectionLabel>Workspace</NavSectionLabel>
            <NavLinks />
          </SectionNav>
        </aside>
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-6xl">
            {pageTitle && (
              <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">{pageTitle}</h1>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
