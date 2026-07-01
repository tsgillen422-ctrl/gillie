import React from "react";
import { useParams } from "wouter";
import { useClerk } from "@clerk/react";
import {
  useGetMe,
  useUpdateMe,
  useGetBlockedUsers,
  useUnblockUser,
  useGetMutedUsers,
  useUnmuteUser,
  useDeleteCurrentUser,
  getGetBlockedUsersQueryKey,
  getGetMutedUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { UserAvatar } from "@/components/UserAvatar";
import { CheckInControl } from "@/components/CheckInControl";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Globe,
  Ban,
  ShieldOff,
  Users,
  Eye,
  EyeOff,
  ShieldCheck,
  Map,
  ScrollText,
  MessageSquare,
  Trash2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WaiverBody } from "@/lib/waiver";
import { useToast } from "@/hooks/use-toast";
import { SettingsShell, SettingsGroup, SettingsSwitchRow } from "@/components/settings-ui";
import { CaptainProfilePage } from "@/pages/settings-profile";
import { VesselDetailsPage } from "@/pages/settings-vessel";
import NotFound from "@/pages/not-found";


/* ---------------------------------------------------------------------------
 * Reusable single-toggle settings page.
 * Preserves the exact optimistic-update + toast behavior of the original
 * cards: flip immediately, roll back and warn on error.
 * ------------------------------------------------------------------------- */

type BoolField =
  | "requireFollowApproval"
  | "showFollowers"
  | "showFriends"
  | "followerSeeLocation"
  | "followerSeePosts"
  | "followerSendMessages"
  | "showMatureContent";

type ToggleConfig = {
  field: BoolField;
  pageTitle: string;
  icon: LucideIcon;
  label: string;
  description: string;
  footer?: string;
  onToast: { title: string; description: string };
  offToast: { title: string; description: string };
  defaultValue?: boolean;
};

function ToggleSettingPage({ config }: { config: ToggleConfig }) {
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (me) {
      const v = (me as any)[config.field];
      setChecked(v ?? config.defaultValue ?? false);
    }
  }, [me, config.field, config.defaultValue]);

  const handleToggle = (next: boolean) => {
    setChecked(next);
    updateMe.mutate({ data: { [config.field]: next } as any }, {
      onSuccess: () => {
        const t = next ? config.onToast : config.offToast;
        toast({ title: t.title, description: t.description });
      },
      onError: () => {
        setChecked(!next);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  return (
    <SettingsShell title={config.pageTitle}>
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : (
        <SettingsGroup footer={config.footer}>
          <SettingsSwitchRow
            icon={config.icon}
            label={config.label}
            description={config.description}
            checked={checked}
            onCheckedChange={handleToggle}
            disabled={updateMe.isPending}
          />
        </SettingsGroup>
      )}
    </SettingsShell>
  );
}

const FOLLOWER_CONTEXT =
  "Applies to followers you don't follow back. People you follow back always keep full access.";

const TOGGLE_CONFIGS: Record<string, ToggleConfig> = {
  "profile-visibility": {
    field: "requireFollowApproval",
    pageTitle: "Profile Visibility",
    icon: Lock,
    label: "Approve New Followers",
    description: "Require approval before someone can follow you",
    footer:
      "When on, new followers must be approved by you before they can follow your account.",
    onToast: { title: "Follow Approval On", description: "New followers will need your approval first." },
    offToast: { title: "Follow Approval Off", description: "Anyone can follow you instantly." },
    defaultValue: false,
  },
  followers: {
    field: "showFollowers",
    pageTitle: "Followers & Following",
    icon: Users,
    label: "Show Followers & Following",
    description: "Let others see who follows you and who you follow",
    onToast: { title: "Followers Visible", description: "Others can see your followers and following." },
    offToast: { title: "Followers Hidden", description: "Only you can see your followers and following." },
    defaultValue: true,
  },
  "friends-visibility": {
    field: "showFriends",
    pageTitle: "Friend List Visibility",
    icon: Users,
    label: "Show Friends List",
    description: "Let others see your friends on your profile",
    onToast: { title: "Friends List Visible", description: "Others can see your friends list on your profile." },
    offToast: { title: "Friends List Hidden", description: "Only you can see your friends list." },
    defaultValue: true,
  },
  messages: {
    field: "followerSendMessages",
    pageTitle: "Who Can Message Me",
    icon: MessageSquare,
    label: "Message Me",
    description: "Let them start a direct message with you",
    footer: FOLLOWER_CONTEXT,
    onToast: { title: "Followers Can Message You", description: "Followers you don't follow back can start a chat with you." },
    offToast: { title: "Follower Messages Off", description: "Only people you follow back can message you." },
    defaultValue: true,
  },
  "posts-visibility": {
    field: "followerSeePosts",
    pageTitle: "Who Can See My Posts",
    icon: ScrollText,
    label: "See My Posts",
    description: "Let them see your friends-only posts",
    footer: FOLLOWER_CONTEXT,
    onToast: { title: "Posts Shared with Followers", description: "Followers you don't follow back can see your friends-only posts." },
    offToast: { title: "Posts Hidden from Followers", description: "Only people you follow back can see your friends-only posts." },
    defaultValue: true,
  },
  "location-visibility": {
    field: "followerSeeLocation",
    pageTitle: "See My Location",
    icon: Map,
    label: "See My Location",
    description: "When you check in, show your boat on the map to followers you don't follow back",
    footer: FOLLOWER_CONTEXT,
    onToast: { title: "Location Shared with Followers", description: "Followers you don't follow back can see you on the map." },
    offToast: { title: "Location Hidden from Followers", description: "Only people you follow back can see you on the map." },
    defaultValue: true,
  },
  "sensitive-content": {
    field: "showMatureContent",
    pageTitle: "Sensitive Content",
    icon: ShieldCheck,
    label: "Show Sensitive Content",
    description: "Reveal posts, photos, and messages flagged as mature instead of blurring them",
    onToast: { title: "Sensitive Content Shown", description: "Content flagged as mature will no longer be blurred." },
    offToast: { title: "Sensitive Content Hidden", description: "Content flagged as mature will be blurred until you tap to view." },
    defaultValue: false,
  },
};

/* --------------------------- Location Check-In --------------------------- */

function LocationCheckInPage() {
  return (
    <SettingsShell title="Location Check-In">
      <div className="rounded-2xl bg-card border border-border p-5">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Check in to share your location with approved friends. You're only on
          the map when you choose to check in.
        </p>
        <CheckInControl variant="card" />
      </div>
    </SettingsShell>
  );
}

/* ----------------------------- Blocked Users ----------------------------- */

function BlockedUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: blocked, isLoading } = useGetBlockedUsers();
  const unblockUser = useUnblockUser();

  const handleUnblock = (userId: number) => {
    unblockUser.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "User unblocked", description: "They can interact with you again." });
        queryClient.invalidateQueries({ queryKey: getGetBlockedUsersQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Couldn't unblock this user.", variant: "destructive" });
      },
    });
  };

  return (
    <SettingsShell title="Blocked Users">
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground">
            <Ban className="w-5 h-5" />
          </span>
          <p className="text-sm text-muted-foreground leading-snug">
            Blocked people can't view your location, message you, send friend
            requests, or interact with you. Unblock to restore access.
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading...</p>
        ) : !blocked || blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">You haven't blocked anyone.</p>
        ) : (
          <div className="space-y-2">
            {blocked.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <Link href={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl ?? undefined} className="w-9 h-9" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </Link>
                <Button variant="outline" size="sm" onClick={() => handleUnblock(u.id)} disabled={unblockUser.isPending}>
                  <ShieldOff className="w-4 h-4 mr-2" /> Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsShell>
  );
}

/* ------------------------------ Hidden Posts ----------------------------- */

function HiddenPostsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: muted, isLoading } = useGetMutedUsers();
  const unmuteUser = useUnmuteUser();

  const handleUnmute = (userId: number) => {
    unmuteUser.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "Posts unhidden", description: "Their posts will show in your feed again." });
        queryClient.invalidateQueries({ queryKey: getGetMutedUsersQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Couldn't unhide this user's posts.", variant: "destructive" });
      },
    });
  };

  return (
    <SettingsShell title="Hidden Posts">
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground">
            <EyeOff className="w-5 h-5" />
          </span>
          <p className="text-sm text-muted-foreground leading-snug">
            People whose posts are hidden from your feed.
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading...</p>
        ) : !muted || muted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">You haven't hidden anyone's posts.</p>
        ) : (
          <div className="space-y-2">
            {muted.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <Link href={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl ?? undefined} className="w-9 h-9" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </Link>
                <Button variant="outline" size="sm" onClick={() => handleUnmute(u.id)} disabled={unmuteUser.isPending}>
                  <Eye className="w-4 h-4 mr-2" /> Unhide
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsShell>
  );
}

/* ----------------------------- Rules & Waiver ---------------------------- */

function WaiverPage() {
  return (
    <SettingsShell title="Rules & Waiver">
      <div className="rounded-2xl bg-card border border-border p-5">
        <WaiverBody />
      </div>
    </SettingsShell>
  );
}

/* ----------------------------- Delete Account ---------------------------- */

function DeleteAccountPage() {
  const { signOut } = useClerk();
  const { toast } = useToast();
  const deleteAccount = useDeleteCurrentUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        signOut({ redirectUrl: basePath || "/" });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete your account. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <SettingsShell title="Delete Account">
      <div className="rounded-2xl border border-destructive/30 bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="w-5 h-5" />
          </span>
          <p className="text-sm text-muted-foreground leading-snug">
            Permanently delete your account and all of your content. This action
            cannot be undone.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete My Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your account along with your posts, photos,
                catches, pins, messages, and other content. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsShell>
  );
}

/* ------------------------------- Dispatcher ------------------------------ */

export function SettingsDetailPage() {
  const { section } = useParams<{ section: string }>();

  if (section === "profile") return <CaptainProfilePage />;
  if (section === "vessel") return <VesselDetailsPage />;
  if (section === "delete-account") return <DeleteAccountPage />;
  if (section === "location-checkin") return <LocationCheckInPage />;
  if (section === "blocked") return <BlockedUsersPage />;
  if (section === "hidden-posts") return <HiddenPostsPage />;
  if (section === "waiver") return <WaiverPage />;

  const toggle = section ? TOGGLE_CONFIGS[section] : undefined;
  if (toggle) return <ToggleSettingPage config={toggle} />;

  return <NotFound />;
}
