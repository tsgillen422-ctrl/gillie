import React from "react";
import { useTheme } from "next-themes";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { SosButton } from "@/components/SosButton";
import { useLogout } from "@/lib/useLogout";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Monitor,
  User,
  Ship,
  Trash2,
  MapPin,
  Eye,
  Users,
  UserCheck,
  MessageSquare,
  ScrollText,
  Repeat2,
  Map as MapIcon,
  ShieldAlert,
  Ban,
  EyeOff,
  Lock,
  BookOpen,
  FileText,
  LifeBuoy,
  ShieldCheck,
  Waves,
} from "lucide-react";
import {
  SettingsGroup,
  SettingsLinkRow,
  SettingsExternalRow,
} from "@/components/settings-ui";

export function SettingsPage() {
  const { data: me, isLoading } = useGetMe();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-y-auto">
      <div
        className="px-4 pb-3 border-b border-border bg-card shadow-sm sticky top-0 z-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
      </div>

      <div className="p-4 max-w-md mx-auto w-full pb-24">
        {/* Profile summary → Captain Profile */}
        <Link
          href="/settings/profile"
          className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 mb-6 transition-colors hover:bg-muted/60 active:bg-muted"
          data-testid="row-profile-summary"
        >
          <UserAvatar
            name={me?.displayName || "User"}
            username={me?.username || ""}
            avatarUrl={me?.avatarUrl ?? undefined}
            className="w-14 h-14 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{me?.displayName || "Your Profile"}</p>
            {me?.username && (
              <p className="text-sm text-muted-foreground truncate">@{me.username}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </Link>

        {/* Appearance */}
        <SettingsGroup title="Appearance">
          <AppearanceRows />
        </SettingsGroup>

        {/* Account */}
        <SettingsGroup title="Account">
          <SettingsLinkRow href="/settings/profile" icon={User} label="Captain Profile" />
          <SettingsLinkRow href="/settings/home-lake" icon={Waves} label="Home Lake" />
          <SettingsLinkRow href="/settings/vessel" icon={Ship} label="My Fleet" />
          <SettingsLinkRow href="/settings/delete-account" icon={Trash2} label="Delete Account" danger />
        </SettingsGroup>

        {/* Privacy */}
        <SettingsGroup title="Privacy">
          <SettingsLinkRow href="/settings/location-checkin" icon={MapPin} label="Location Check-In" />
          <SettingsLinkRow href="/settings/profile-visibility" icon={Eye} label="Profile Visibility" />
          <SettingsLinkRow href="/settings/followers" icon={Users} label="Followers & Following" />
          <SettingsLinkRow href="/settings/friends-visibility" icon={UserCheck} label="Friend List Visibility" />
          <SettingsLinkRow href="/settings/messages" icon={MessageSquare} label="Who Can Message Me" />
          <SettingsLinkRow href="/settings/posts-visibility" icon={ScrollText} label="Who Can See My Posts" />
          <SettingsLinkRow href="/settings/reposts" icon={Repeat2} label="Sharing My Posts" />
          <SettingsLinkRow href="/settings/location-visibility" icon={MapIcon} label="See My Location" />
          <SettingsLinkRow href="/settings/sensitive-content" icon={ShieldAlert} label="Sensitive Content" />
          <SettingsLinkRow href="/settings/blocked" icon={Ban} label="Blocked Users" />
          <SettingsLinkRow href="/settings/hidden-posts" icon={EyeOff} label="Hidden Posts" />
        </SettingsGroup>

        {/* Legal & Safety */}
        <SettingsGroup title="Legal & Safety">
          <SettingsLinkRow href="/privacy-policy" icon={Lock} label="Privacy Policy" />
          <SettingsLinkRow href="/community-guidelines" icon={BookOpen} label="Community Guidelines" />
          <SettingsLinkRow href="/settings/waiver" icon={FileText} label="Rules & Waiver" />
        </SettingsGroup>

        {/* Help & Support */}
        <SettingsGroup title="Help & Support">
          <SettingsExternalRow
            href="mailto:gillie.apphelp@yahoo.com"
            icon={LifeBuoy}
            label="Help & Support"
            value="Email us"
            testId="link-support-email"
          />
        </SettingsGroup>

        {/* Admin */}
        {me?.isAdmin && (
          <SettingsGroup title="Admin">
            <SettingsLinkRow href="/admin" icon={ShieldCheck} label="Moderation Dashboard" />
          </SettingsGroup>
        )}

        {/* Log out + SOS */}
        <div className="flex items-center gap-3 mt-2">
          <LogoutButton />
          <SosButton />
        </div>
      </div>
    </div>
  );
}

function AppearanceRows() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const current = mounted ? (theme ?? "system") : "system";

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
          {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium">Dark Mode</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current === "system" ? "Following your device setting" : "Switch between light and dark themes"}
          </p>
        </div>
        <Switch
          checked={isDark}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          className="data-[state=checked]:bg-primary shrink-0"
          aria-label="Toggle dark mode"
        />
      </div>
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-2.5">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${active ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
                aria-pressed={active}
              >
                <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function LogoutButton() {
  const logout = useLogout();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <Button
      variant="outline"
      className="flex-1 text-destructive hover:text-destructive"
      onClick={() => logout(basePath || "/")}
    >
      <LogOut className="w-4 h-4 mr-2" /> Log Out
    </Button>
  );
}
