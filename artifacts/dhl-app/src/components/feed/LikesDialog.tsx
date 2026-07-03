import React from "react";
import { useGetPostLikes, getGetPostLikesQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { REACTIONS, REACTION_MAP, type ReactionKey } from "@/lib/reactions";

export function LikesDialog({ postId, open, onOpenChange }: { postId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: likes, isLoading } = useGetPostLikes(postId, { query: { enabled: open, queryKey: getGetPostLikesQueryKey(postId) } });
  const [filter, setFilter] = React.useState<ReactionKey | "all">("all");
  React.useEffect(() => { if (!open) setFilter("all"); }, [open]);

  const counts: Record<string, number> = {};
  for (const l of likes ?? []) counts[l.reaction] = (counts[l.reaction] || 0) + 1;
  const total = likes?.length ?? 0;
  const available = REACTIONS.filter((r) => (counts[r.key] || 0) > 0);
  React.useEffect(() => {
    if (filter !== "all" && !available.some((r) => r.key === filter)) setFilter("all");
  }, [filter, available]);
  const filtered = filter === "all" ? (likes ?? []) : (likes ?? []).filter((l) => l.reaction === filter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reactions</DialogTitle>
          <DialogDescription className="sr-only">People who reacted to this post</DialogDescription>
        </DialogHeader>
        {total > 0 && (
          <div className="flex items-center gap-4 overflow-x-auto border-b border-border/60 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`shrink-0 pb-2 text-sm font-semibold border-b-2 transition-colors ${filter === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              All {total}
            </button>
            {available.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setFilter(r.key)}
                aria-label={`${r.label} ${counts[r.key]}`}
                className={`shrink-0 pb-2 flex items-center gap-1.5 text-sm font-semibold border-b-2 transition-colors ${filter === r.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <span className="text-base leading-none">{r.emoji}</span>
                <span>{counts[r.key]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="max-h-80 overflow-y-auto -mx-2">
          {isLoading ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length > 0 ? (
            filtered.map((l) => (
              <div key={l.userId} className="flex items-center gap-3 px-2 py-2">
                <div className="relative shrink-0">
                  <UserAvatar name={l.user?.displayName || "User"} username={l.user?.username || ""} avatarUrl={l.user?.avatarUrl} className="w-9 h-9" />
                  <span className="absolute -bottom-1 -right-1 text-sm leading-none">{REACTION_MAP[l.reaction]?.emoji || "❤️"}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.user?.displayName || "User"}</p>
                  {l.user?.username && <p className="truncate text-xs text-muted-foreground">@{l.user.username}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No reactions yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
