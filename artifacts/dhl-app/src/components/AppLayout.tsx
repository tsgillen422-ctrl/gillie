import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, MessageCircle, MapPin, Bell, Settings } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Map" },
    { href: "/feed", icon: Users, label: "Feed" },
    { href: "/pins", icon: MapPin, label: "Pins" },
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/friends", icon: Users, label: "Friends" },
    { href: "/notifications", icon: Bell, label: "Alerts" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <main className="flex-1 relative overflow-y-auto">
        {children}
      </main>
      
      {/* Bottom Nav for Mobile / Shared */}
      <nav className="border-t border-border bg-card shrink-0 pb-safe z-50">
        <ul className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center h-full w-full gap-1 transition-colors ${
                  location === item.href || (location === "/map" && item.href === "/")
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
