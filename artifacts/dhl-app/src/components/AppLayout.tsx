import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, MessageCircle, MapPin, Bell, Settings, User, Search } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Map" },
    { href: "/feed", icon: Users, label: "Feed" },
    { href: "/pins", icon: MapPin, label: "Pins" },
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/profile/me", icon: User, label: "Profile" },
  ];

  const isActive = (href: string) =>
    location === href || (location === "/map" && href === "/");

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0 z-50">
        <span className="font-bold text-primary tracking-tight">Dale Hollow</span>
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

      <main className="flex-1 grid relative overflow-hidden min-h-0">
        {children}
      </main>

      {/* Bottom Nav for Mobile / Shared */}
      <nav className="border-t border-border bg-card shrink-0 pb-safe z-50">
        <ul className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => (
            <li key={item.href} className="flex-1">
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
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
