import React from "react";
import {
  useGetFriendSuggestions,
  useFollowUser,
  getGetFriendSuggestionsQueryKey,
  getGetFriendsQueryKey,
  type SuggestedUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { boatLabelFor } from "@/boats";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { UserPlus, Check, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "dhl-suggested-friends-dismissed";
const OPEN_EVENT = "dhl:open-suggested-friends";

/** Reopen the suggested-friends bottom sheet on demand (e.g. from a feed button). */
export function openSuggestedFriends() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function SuggestionCard({ user }: { user: SuggestedUser }) {
  const queryClient = useQueryClient();
  const followUser = useFollowUser();
  const [added, setAdded] = React.useState(false);

  const boat = user.boatType ? boatLabelFor(user.boatType) : null;
  const subtitle =
    user.mutualFriendCount > 0
      ? `${user.mutualFriendCount} mutual friend${user.mutualFriendCount > 1 ? "s" : ""}`
      : user.reason;

  const handleAdd = () => {
    if (added || followUser.isPending) return;
    followUser.mutate(
      { userId: user.id },
      {
        onSuccess: () => {
          setAdded(true);
          toast.success(`Added ${user.displayName}`);
          queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFriendSuggestionsQueryKey() });
        },
        onError: () => toast.error("Couldn't add friend. Try again."),
      },
    );
  };

  return (
    <Card className="hover-elevate overflow-hidden border-border/50">
      <CardContent className="p-3 flex items-center gap-3">
        <UserAvatar
          name={user.displayName}
          username={user.username}
          avatarUrl={user.avatarUrl}
          online={user.isOnline}
          className="w-12 h-12"
        />
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${user.id}`} className="font-semibold text-foreground truncate hover:underline block">
            {user.displayName}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            {boat && (
              <>
                <span className="shrink-0">{boat}</span>
                <span aria-hidden className="text-muted-foreground/50">·</span>
              </>
            )}
            <span className="truncate">{subtitle}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={added ? "secondary" : "default"}
          disabled={added || followUser.isPending}
          onClick={handleAdd}
        >
          {added ? (
            <>
              <Check className="w-4 h-4 mr-1" /> Added
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-1" /> Add Friend
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/** The list of suggestions on its own — used inside the Friends page tab. */
export function SuggestedFriendsList() {
  const { data, isLoading } = useGetFriendSuggestions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No suggestions yet</h3>
        <p className="text-muted-foreground text-sm">
          Connect with people and explore the lake — we'll surface folks you may know here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((user) => (
        <SuggestionCard key={user.id} user={user} />
      ))}
    </div>
  );
}

/**
 * Auto-opening bottom sheet for the feed screen. Pops up once with suggestions;
 * dismissing it remembers the choice (localStorage) so it won't reappear, while
 * the list stays reachable from the Friends page "Suggested" tab.
 */
export function SuggestedFriendsDrawer() {
  const { data } = useGetFriendSuggestions();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (data && data.length > 0) setOpen(true);
  }, [data]);

  // Allow reopening on demand (e.g. the feed button), even after dismissal.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  };

  if (!data || data.length === 0) return null;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Suggested Friends
          </DrawerTitle>
          <DrawerDescription>People you may know around Dale Hollow Lake.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-3 overflow-y-auto max-h-[60vh]">
          {data.map((user) => (
            <SuggestionCard key={user.id} user={user} />
          ))}
          <Link
            href="/friends?tab=suggested"
            onClick={() => setOpen(false)}
            className="block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold text-primary hover-elevate active:scale-[0.99]"
          >
            See all on Friends page
          </Link>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Lightweight feed entry point: reopens the suggested-friends sheet on demand,
 * so users can get back to suggestions after dismissing the auto-popup.
 */
export function SuggestedFriendsButton() {
  const { data } = useGetFriendSuggestions();
  if (!data || data.length === 0) return null;

  return (
    <button
      type="button"
      onClick={openSuggestedFriends}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover-elevate active:scale-[0.99] transition-transform"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">Suggested friends</div>
        <div className="truncate text-xs text-muted-foreground">
          {data.length} {data.length === 1 ? "person" : "people"} you may know around Dale Hollow
        </div>
      </div>
      <UserPlus className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
