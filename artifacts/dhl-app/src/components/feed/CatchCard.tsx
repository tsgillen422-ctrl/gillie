import React from "react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { resolveImageSrc } from "@/lib/assets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { MatureGate } from "@/components/MatureGate";
import { Scale, Fish, MapPin, Lock, MessageCircle, Share2, Bookmark, BookmarkCheck, Send, Trash2 } from "lucide-react";
import { ClickableImage } from "@/components/ClickableImage";
import { ReactionButton } from "./ReactionButton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useReactToCatch,
  useSaveCatch,
  useUnsaveCatch,
  useGetCatchComments,
  useCreateCatchComment,
  useDeleteCatchComment,
  getGetCatchCommentsQueryKey,
  getGetCatchesQueryKey,
} from "@workspace/api-client-react";
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

export function CatchCard({
  catchData,
  href,
  meId,
  onDelete,
  anchorId,
}: {
  catchData: any;
  href?: string;
  meId?: number;
  onDelete?: (id: number) => void;
  anchorId?: string;
}) {
  const [, navigate] = useLocation();
  const [showComments, setShowComments] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const queryClient = useQueryClient();

  const reactToCatch = useReactToCatch();
  const saveCatch = useSaveCatch();
  const unsaveCatch = useUnsaveCatch();
  const createComment = useCreateCatchComment();
  const deleteComment = useDeleteCatchComment();
  const { data: comments } = useGetCatchComments(catchData?.id ?? 0, {
    query: {
      queryKey: getGetCatchCommentsQueryKey(catchData?.id ?? 0),
      enabled: showComments && Boolean(catchData?.id),
    },
  });

  if (!catchData) return null;

  const refreshCatches = () => queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() });
  const refreshComments = () =>
    queryClient.invalidateQueries({ queryKey: getGetCatchCommentsQueryKey(catchData.id) });

  const handleReact = (reaction: string) => {
    reactToCatch.mutate(
      { catchId: catchData.id, data: { reaction: reaction as any } },
      { onSuccess: refreshCatches, onError: () => toast.error("Couldn't react to that catch.") }
    );
  };

  const handleSaveToggle = () => {
    const opts = { onSuccess: refreshCatches, onError: () => toast.error("Couldn't update saved catches.") };
    if (catchData.savedByMe) unsaveCatch.mutate({ catchId: catchData.id }, opts);
    else saveCatch.mutate({ catchId: catchData.id }, { ...opts, onSuccess: () => { refreshCatches(); toast.success("Catch saved."); } });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}catches?catch=${catchData.id}`.replace(/([^:])\/\//g, "$1/");
    const title = `${catchData.species || "Catch"} on Gillie`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const handleComment = () => {
    const content = commentText.trim();
    if (!content) return;
    createComment.mutate(
      { catchId: catchData.id, data: { content } },
      {
        onSuccess: () => {
          setCommentText("");
          refreshComments();
          refreshCatches();
        },
        onError: () => toast.error("Couldn't post that comment."),
      }
    );
  };

  const handleDeleteComment = (commentId: number) => {
    deleteComment.mutate(
      { catchId: catchData.id, commentId },
      { onSuccess: () => { refreshComments(); refreshCatches(); }, onError: () => toast.error("Couldn't delete that comment.") }
    );
  };

  // Tapping the card body (outside the zoomable photo and the action row,
  // which stop propagation) deep-links to the catch on the Catches page.
  const clickable = Boolean(href);
  const isOwner = meId != null && catchData.userId === meId;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Card
      id={anchorId}
      onClick={clickable ? () => navigate(href!) : undefined}
      onKeyDown={
        clickable
          ? (e: React.KeyboardEvent) => {
              if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                e.preventDefault();
                navigate(href!);
              }
            }
          : undefined
      }
      role={clickable ? "link" : undefined}
      aria-label={clickable ? `View ${catchData.species || "catch"} by ${catchData.user?.displayName || "angler"}` : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={`card-catch-${catchData.id}`}
      className={`mb-4 overflow-hidden rounded-2xl border-none shadow-soft transition-all hover:shadow-soft-lg bg-card ${clickable ? "cursor-pointer" : ""}`}
    >
      <div className="flex flex-col">
        {/* User header */}
        <div className="flex items-center gap-3 p-4 pb-3" onClick={stop}>
          <Link href={`/profile/${catchData.userId}`} className="shrink-0">
            <UserAvatar
              name={catchData.user?.displayName || "Angler"}
              username={catchData.user?.username || ""}
              avatarUrl={catchData.user?.avatarUrl}
              className="h-10 w-10 shrink-0 shadow-sm"
            />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col">
            <Link href={`/profile/${catchData.userId}`} className="text-sm font-semibold truncate text-foreground hover:underline">
              {catchData.user?.displayName || "Angler"}
            </Link>
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              {catchData.caughtAt ? formatDistanceToNow(new Date(catchData.caughtAt), { addSuffix: true }) : "Recently"}
              {catchData.locationName && (
                <>
                  <span aria-hidden>·</span>
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{catchData.locationName}</span>
                </>
              )}
            </span>
          </div>
          {catchData.isPrivate && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {isOwner && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  aria-label="Delete catch"
                  data-testid={`button-delete-catch-${catchData.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={stop}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this catch?</AlertDialogTitle>
                  <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(catchData.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Media / catch details */}
        <MatureGate isMature={catchData.isMature} rounded="rounded-none" label="Sensitive catch">
          {catchData.imageUrl ? (
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
              <ClickableImage
                src={resolveImageSrc(catchData.imageUrl)}
                alt={catchData.species || "Catch"}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                  <Fish className="h-5 w-5 text-accent" />
                  <span className="text-xl font-bold font-display tracking-tight drop-shadow-sm">
                    {catchData.species || "Unknown Species"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium drop-shadow-sm">
                  {catchData.weight && (
                    <div className="flex items-center gap-1.5">
                      <Scale className="h-4 w-4 opacity-80" />
                      <span>{catchData.weight} lbs</span>
                    </div>
                  )}
                  {catchData.length && (
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-80 leading-none text-base">📏</span>
                      <span>{catchData.length} in</span>
                    </div>
                  )}
                  {catchData.bait && (
                    <div className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-md">
                      <span>🪱 {catchData.bait}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-1">
              <div className="flex items-center gap-2 mb-2">
                <Fish className="h-5 w-5 text-primary" />
                <span className="text-xl font-bold font-display">
                  {catchData.species || "Unknown Species"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
                {catchData.weight && (
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-4 w-4" />
                    <span>{catchData.weight} lbs</span>
                  </div>
                )}
                {catchData.length && (
                  <div className="flex items-center gap-1.5">
                    <span className="leading-none text-base">📏</span>
                    <span>{catchData.length} in</span>
                  </div>
                )}
                {catchData.bait && (
                  <div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded-full">
                    <span>🪱 {catchData.bait}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </MatureGate>

        <CardContent className="p-4 pt-3">
          {catchData.notes && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed mb-2">
              {catchData.notes}
            </p>
          )}

          {/* Social action row */}
          <div className="flex items-center gap-1 -ml-2 pt-1 border-t border-border/40" onClick={stop}>
            <ReactionButton target={catchData} onReact={handleReact} />
            <Button
              variant="ghost"
              size="sm"
              className={`font-semibold transition-colors hover:bg-muted/50 rounded-full px-3 ${showComments ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
              onClick={() => setShowComments((v) => !v)}
              data-testid={`button-catch-comments-${catchData.id}`}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              {catchData.commentCount > 0 ? catchData.commentCount : "Comment"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-muted-foreground transition-colors hover:bg-muted/50 rounded-full px-3"
              onClick={handleShare}
              data-testid={`button-catch-share-${catchData.id}`}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full ${catchData.savedByMe ? "text-primary" : "text-muted-foreground"}`}
              onClick={handleSaveToggle}
              aria-label={catchData.savedByMe ? "Unsave catch" : "Save catch"}
              data-testid={`button-catch-save-${catchData.id}`}
            >
              {catchData.savedByMe ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </Button>
          </div>

          {/* Comments */}
          {showComments && (
            <div className="mt-3 space-y-3" onClick={stop}>
              {(comments || []).map((c: any) => (
                <div key={c.id} className="flex items-start gap-2.5" data-testid={`catch-comment-${c.id}`}>
                  <Link href={`/profile/${c.userId}`} className="shrink-0">
                    <UserAvatar
                      name={c.user?.displayName || "User"}
                      username={c.user?.username || ""}
                      avatarUrl={c.user?.avatarUrl}
                      className="h-7 w-7"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted/60 rounded-2xl px-3 py-2">
                      <span className="text-xs font-semibold block">{c.user?.displayName || "User"}</span>
                      <MatureGate isMature={c.isMature} rounded="rounded-lg" label="Sensitive comment">
                        <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                      </MatureGate>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-3">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {(c.userId === meId || isOwner) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDeleteComment(c.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                  placeholder="Add a comment…"
                  className="rounded-full h-9"
                  data-testid={`input-catch-comment-${catchData.id}`}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  onClick={handleComment}
                  disabled={!commentText.trim() || createComment.isPending}
                  aria-label="Post comment"
                  data-testid={`button-catch-comment-send-${catchData.id}`}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
