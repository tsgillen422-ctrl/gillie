import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, MessageCircle, MapPin, Bell, Settings, User, Search, Plus } from "lucide-react";
import { SwipeBack } from "@/components/swipe-back";
import { LakeSwitcher } from "@/components/LakeSwitcher";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Map" },
    { href: "/feed", icon: Users, label: "Feed" },
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/profile/me", icon: User, label: "Profile" },
  ];

  const isActive = (href: string) =>
    location === href || (location === "/map" && href === "/");

  const hideHeader = location === "/feed";

  const renderNavItem = (item: (typeof navItems)[number]) => (
    <div key={item.href} className="flex-1">
      <Link
        href={item.href}
        className={`flex flex-col items-center justify-center h-full w-full gap-1 transition-colors ${
          isActive(item.href)
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <item.icon className="w-5 h-5" />
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {!hideHeader && (
        <header
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          className="flex items-center justify-between px-4 min-h-[3rem] border-b border-border bg-card shrink-0 z-50"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <span className="shrink-0 font-script text-2xl font-bold leading-none text-primary">Gillie</span>
            <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
            <LakeSwitcher className="min-w-0 text-sm" />
            <Link
              href="/lakes"
              aria-label="Explore lakes"
              data-testid="button-explore-lakes"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base hover:bg-muted active:scale-95 transition"
            >
              <span aria-hidden>🌎</span>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                location === "/search" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              href="/pins"
              aria-label="Pins"
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                location === "/pins" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapPin className="w-5 h-5" />
            </Link>
            <Link
              href="/notifications"
              aria-label="Alerts"
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                location === "/notifications" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bell className="w-5 h-5" />
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                location === "/settings" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        <SwipeBack>{children}</SwipeBack>
      </main>

      {/* Bottom Nav for Mobile / Shared */}
      <nav className="border-t border-border bg-card shrink-0 pb-safe z-50">
        <div className="flex items-stretch h-16 px-2">
          <div className="flex flex-1 items-stretch">
            {navItems.slice(0, 2).map(renderNavItem)}
          </div>
          <div className="flex shrink-0 items-center justify-center px-3">
            <Link
              href="/feed?compose=1"
              aria-label="Create"
              className="flex h-14 w-14 -mt-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition"
            >
              <Plus className="h-7 w-7" />
            </Link>
          </div>
          <div className="flex flex-1 items-stretch">
            {navItems.slice(2).map(renderNavItem)}
          </div>
        </div>
      </nav>
    </div>
  );
}
