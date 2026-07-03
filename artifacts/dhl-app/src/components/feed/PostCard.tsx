import React from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { resolveImageSrc } from "@/lib/assets";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { ClickableImage } from "@/components/ClickableImage";
import { MatureGate } from "@/components/MatureGate";
import { VideoPlayer } from "./VideoPlayer";
import { REACTIONS, REACTION_MAP, DEFAULT_REACTION, type ReactionKey } from "@/lib/reactions";
import {
  MapPin, Heart, MessageCircle, Share2, MoreHorizontal, Flag, Trash2, Sailboat, ImagePlus, Video, X, Send, Check,
  Bookmark, BookmarkCheck, Link2, Repeat2, Pencil, EyeOff, Ban
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePostComment,
  useDeletePostComment,
  useGetPostComments,
  useReactToComment,
  getGetPostCommentsQueryKey,
} from "@workspace/api-client-react";
import { ReportDialog } from "@/components/ReportDialog";
import { LikesDialog } from "./LikesDialog";
import { toast } from "sonner";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";

function ReactionButton({ post, onReact }: { post: any; onReact: (reaction: ReactionKey) => void }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);

  const current = post.myReaction ? REACTION_MAP[post.myReaction] : null;
  const counts: Record<string, number> = post.reactionCounts || {};
  const total = post.likeCount || 0;
  const topEmojis = REACTIONS.filter((r) => (counts[r.key] || 0) > 0)
    .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0))
    .slice(0, 3)
    .map((r) => r.emoji);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    longPressed.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressed.current = true;
      setPickerOpen(true);
    }, 350);
  };

  const handleClick = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onReact((post.myReaction as ReactionKey) || DEFAULT_REACTION);
  };

  const choose = (key: ReactionKey) => {
    setPickerOpen(false);
    longPressed.current = false;
    onReact(key);
  };

  React.useEffect(() => () => clearTimer(), []);

  return (
    <div className="relative flex-1">
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-50 flex gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-xl animate-in zoom-in-95 duration-200">
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => choose(r.key)}
                aria-label={r.label}
                title={r.label}
                className={`text-2xl leading-none transition-transform hover:scale-125 active:scale-110 ${post.myReaction === r.key ? "scale-110" : ""}`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={`w-full select-none font-semibold transition-colors hover:bg-muted/50 ${current ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
      >
        {current ? (
          <span className="mr-2 text-base leading-none animate-in zoom-in-50 duration-200">{current.emoji}</span>
        ) : topEmojis.length > 0 ? (
          <span className="mr-2 text-base leading-none">{topEmojis.join("")}</span>
        ) : (
          <Heart className="w-4 h-4 mr-2" />
        )}
        {total > 0 ? total : "Like"}
      </Button>
    </div>
  );
}

function CommentReactionButton({ comment, onReact }: { comment: any; onReact: (reaction: ReactionKey) => void }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);

  const current = comment.myReaction ? REACTION_MAP[comment.myReaction] : null;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    longPressed.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressed.current = true;
      setPickerOpen(true);
    }, 350);
  };

  const handleClick = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onReact((comment.myReaction as ReactionKey) || DEFAULT_REACTION);
  };

  const choose = (key: ReactionKey) => {
    setPickerOpen(false);
    longPressed.current = false;
    onReact(key);
  };

  React.useEffect(() => () => clearTimer(), []);

  return (
    <div className="relative flex items-center gap-1.5">
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 flex gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg animate-in zoom-in-95 duration-200">
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => choose(r.key)}
                className={`text-lg leading-none transition-transform hover:scale-125 active:scale-110 ${comment.myReaction === r.key ? "scale-110" : ""}`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        className={`text-xs font-semibold select-none transition-colors ${current ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        {current ? "Liked" : "Like"}
      </button>
      {comment.likeCount > 0 && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="text-sm leading-none">
            {current ? current.emoji : "❤️"}
          </span>
          {comment.likeCount}
        </span>
      )}
    </div>
  );
}

function PhotoCarousel({ photos, alt }: { photos: string[]; alt: string }) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [idx, setIdx] = React.useState(0);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIdx(Math.min(photos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <div className="relative w-full overflow-hidden bg-muted">
        <ClickableImage src={resolveImageSrc(photos[0])} alt={alt} className="w-full max-h-[600px] min-h-[280px] object-cover" />
      </div>
    );
  }
  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
      >
        {photos.map((url, i) => (
          <div key={`${url}-${i}`} className="w-full shrink-0 snap-center bg-muted aspect-[4/3] overflow-hidden">
            <ClickableImage src={resolveImageSrc(url)} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm pointer-events-none">
        {idx + 1}/{photos.length}
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
          />
        ))}
      </div>
    </div>
  );
}

function PollView({ post, votePoll, queryClient, getGetPostsQueryKey, getGetSavedPostsQueryKey }: any) {
  const poll = post.poll as { options: { id: number; text: string; voteCount: number }[]; totalVotes: number; myVote?: number | null } | undefined;
  if (!poll || !poll.options?.length) return null;
  const total = poll.totalVotes || 0;
  const myVote = poll.myVote ?? null;
  const handleVote = (optionId: number) => {
    if (votePoll.isPending) return;
    votePoll.mutate(
      { postId: post.id, data: { optionId } },
      { onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
      } },
    );
  };
  return (
    <div className="mt-4 space-y-2 mb-2 px-4">
      {poll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
        const mine = myVote === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={votePoll.isPending}
            onClick={() => handleVote(opt.id)}
            className="relative w-full overflow-hidden rounded-xl border border-border px-3 py-2.5 text-left transition hover-elevate active:scale-[0.99] disabled:opacity-70 shadow-sm"
          >
            <span className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${mine ? "bg-primary/20" : "bg-muted/60"}`} style={{ width: `${pct}%` }} aria-hidden />
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                {mine && <Check className="h-4 w-4 shrink-0 text-primary drop-shadow-sm" />}
                <span className="truncate">{opt.text}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">{pct}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs font-medium text-muted-foreground pt-1">{total} {total === 1 ? "vote" : "votes"}{myVote ? " · Tap to change" : ""}</p>
    </div>
  );
}

export function PostCard({
  post,
  currentUserId,
  canDelete,
  onReact,
  onDelete,
  onMuteUser,
  onBlockUser,
  onToggleRsvp,
  onSave,
  onUnsave,
  onShareToProfile,
  onUpdatePost,
  votePoll,
  getGetPostsQueryKey,
  getGetSavedPostsQueryKey
}: any) {
  const [showComments, setShowComments] = React.useState(false);
  const [showLikes, setShowLikes] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [commentImageUrl, setCommentImageUrl] = React.useState<string | null>(null);
  const [commentVideoUrl, setCommentVideoUrl] = React.useState<string | null>(null);
  const [isUploadingComment, setIsUploadingComment] = React.useState(false);

  const queryClient = useQueryClient();
  const createComment = useCreatePostComment();
  const deleteComment = useDeletePostComment();
  const reactToComment = useReactToComment();
  const { uploadFile } = useUpload();
  
  const commentImageInputRef = React.useRef<HTMLInputElement>(null);
  const commentVideoInputRef = React.useRef<HTMLInputElement>(null);

  const { data: comments } = useGetPostComments(post.id, {
    query: {
      enabled: showComments,
      queryKey: getGetPostCommentsQueryKey(post.id),
    },
  });

  const commentCount = post.commentCount || 0;
  const likeTotal = post.likeCount || 0;
  const isBoat = post.postType === "boat_showcase";
  const isEvent = post.postType === "event" || post.postType === "tie_up";
  const mediaPhotos: string[] =
    Array.isArray(post.photos) && post.photos.length
      ? post.photos
      : post.imageUrl
        ? [post.imageUrl]
        : [];
  const boatSpecs: { label: string; value: string }[] = [];
  if (isBoat) {
    if (post.engineSetup) boatSpecs.push({ label: "Engine", value: String(post.engineSetup) });
    if (post.horsepower != null) boatSpecs.push({ label: "Horsepower", value: `${post.horsepower} HP` });
    if (post.topSpeed != null) boatSpecs.push({ label: "Top speed", value: `${post.topSpeed} mph` });
    if (post.mods) boatSpecs.push({ label: "Mods", value: String(post.mods) });
  }

  const refreshComments = () => {
    queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(post.id) });
  };

  const handleReactComment = (commentId: number, reaction: ReactionKey) => {
    reactToComment.mutate(
      { postId: post.id, commentId, data: { reaction } },
      { onSuccess: refreshComments, onError: () => toast.error("Couldn't react to that comment.") }
    );
  };

  const removeComment = (commentId: number) => {
    deleteComment.mutate(
      { postId: post.id, commentId },
      { onSuccess: refreshComments, onError: () => toast.error("Couldn't delete that comment.") }
    );
  };

  const handleShareExternal = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}feed?post=${post.id}`;
    const title = post.title || post.user?.displayName || "Gillie post";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  };

  const submitComment = () => {
    if (!commentText.trim() && !commentImageUrl && !commentVideoUrl) return;
    createComment.mutate({
      postId: post.id,
      data: {
        content: commentText.trim() || undefined,
        imageUrl: commentImageUrl || undefined,
        videoUrl: commentVideoUrl || undefined,
      }
    }, {
      onSuccess: () => {
        setCommentText("");
        setCommentImageUrl(null);
        setCommentVideoUrl(null);
        queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(post.id) });
      }
    });
  };

  const handleCommentImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingComment(true);
    try {
      const res = await uploadFile(await compressImage(file));
      if (res?.objectPath) {
        setCommentImageUrl(res.objectPath);
        setCommentVideoUrl(null);
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingComment(false);
      if (commentImageInputRef.current) commentImageInputRef.current.value = "";
    }
  };

  const handleCommentVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingComment(true);
    try {
      const res = await uploadFile(file);
      if (res?.objectPath) {
        setCommentVideoUrl(res.objectPath);
        setCommentImageUrl(null);
      }
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setIsUploadingComment(false);
      if (commentVideoInputRef.current) commentVideoInputRef.current.value = "";
    }
  };

  const topLikeEmojis = REACTIONS.filter((r) => (post.reactionCounts?.[r.key] || 0) > 0)
    .sort((a, b) => (post.reactionCounts?.[b.key] || 0) - (post.reactionCounts?.[a.key] || 0))
    .slice(0, 3)
    .map((r) => r.emoji);

  return (
    <Card id={`post-${post.id}`} className="mb-5 overflow-hidden rounded-[20px] border-none shadow-soft transition-all hover:shadow-soft-lg bg-card animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <CardHeader className="flex flex-row items-start gap-3 p-4 pb-3">
        <Link href={`/profile/${post.userId}`} className="shrink-0 block mt-1">
          <UserAvatar
            name={post.user?.displayName || "User"}
            username={post.user?.username || ""}
            avatarUrl={post.user?.avatarUrl}
            className="h-11 w-11 shadow-sm"
          />
        </Link>
        <div className="flex-1 min-w-0 flex flex-col justify-center h-11">
          <div className="flex items-center gap-1.5 flex-wrap leading-tight">
            <Link href={`/profile/${post.userId}`}>
              <span className="font-bold text-foreground text-[15px] truncate cursor-pointer hover:underline tracking-tight">
                {post.user?.displayName}
              </span>
            </Link>
            {post.user?.boatName && (
              <>
                <span className="text-muted-foreground/50 text-[10px]">•</span>
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Sailboat className="h-3 w-3 text-primary/70" />
                  {post.user.boatName}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center text-[11px] font-medium text-muted-foreground mt-0.5 gap-1.5 flex-wrap">
            <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
            {post.placeName && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-0.5 text-primary/80">
                  <MapPin className="h-3 w-3" />
                  {post.placeName}
                </span>
              </>
            )}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground shrink-0 hover:bg-muted/50 rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-border/50">
            {post.savedByMe ? (
              <DropdownMenuItem onClick={() => onUnsave(post.id)} className="font-medium cursor-pointer">
                <BookmarkCheck className="mr-2 h-4 w-4" /> Unsave post
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onSave(post.id)} className="font-medium cursor-pointer">
                <Bookmark className="mr-2 h-4 w-4" /> Save post
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="font-medium cursor-pointer" onClick={handleShareExternal}>
              <Link2 className="mr-2 h-4 w-4" /> Share link
            </DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => onShareToProfile(post.id)}>
              <Repeat2 className="mr-2 h-4 w-4" /> Repost to my profile
            </DropdownMenuItem>
            {currentUserId === post.userId && (
              <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => onUpdatePost(post)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit post
              </DropdownMenuItem>
            )}
            {currentUserId !== post.userId && (
              <>
                <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => onMuteUser(post.userId)}>
                  <EyeOff className="mr-2 h-4 w-4" /> Mute user
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive font-medium cursor-pointer" onClick={() => setBlockConfirmOpen(true)}>
                  <Ban className="mr-2 h-4 w-4" /> Block user
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive font-medium cursor-pointer" onClick={() => setReportOpen(true)}>
                  <Flag className="mr-2 h-4 w-4" /> Report post
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <DropdownMenuItem className="text-destructive focus:text-destructive font-medium cursor-pointer" onClick={() => onDelete(post.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete post
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="p-0">
        <div className="px-4 pb-3 space-y-2">
          {post.title && (
            <h3 className="font-display font-bold text-[19px] tracking-tight leading-tight text-foreground">
              {post.title}
            </h3>
          )}
          {post.content && (
            <p className="text-foreground/90 whitespace-pre-wrap break-words text-sm leading-[1.6]">
              {post.content}
            </p>
          )}
        </div>

        {isEvent && post.eventDate && (
          <div className="px-4 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-background shadow-sm border border-border/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 leading-none">
                    {new Date(post.eventDate).toLocaleDateString(undefined, { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold leading-none text-foreground mt-0.5">
                    {new Date(post.eventDate).getDate()}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {new Date(post.eventDate).toLocaleDateString(undefined, { weekday: 'long' })}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {new Date(post.eventDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={post.rsvpByMe ? "secondary" : "default"}
                onClick={() => onToggleRsvp(post.id)}
                className={`rounded-full h-8 px-4 font-bold ${post.rsvpByMe ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'}`}
              >
                {post.rsvpByMe ? "Going" : "RSVP"}
                {post.rsvpCount > 0 && <span className="ml-1.5 pl-1.5 border-l border-current/20 opacity-90">{post.rsvpCount}</span>}
              </Button>
            </div>
          </div>
        )}

        <MatureGate isMature={post.isMature}>
          {post.sharedPostId ? (
            post.sharedPost ? (
              <Link href={`/feed?post=${post.sharedPost.id}`} className="block mx-4 mb-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden hover-elevate">
                  <div className="p-3 pb-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <UserAvatar name={post.sharedPost.user?.displayName || "User"} username={post.sharedPost.user?.username || ""} avatarUrl={post.sharedPost.user?.avatarUrl} className="w-6 h-6" />
                      <span className="font-semibold text-xs truncate">{post.sharedPost.user?.displayName}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(post.sharedPost.createdAt), { addSuffix: true })}</span>
                    </div>
                    {post.sharedPost.title && <h4 className="font-bold text-sm mb-0.5">{post.sharedPost.title}</h4>}
                    {post.sharedPost.content && <p className="text-sm whitespace-pre-wrap line-clamp-6">{post.sharedPost.content}</p>}
                  </div>
                  {post.sharedPost.imageUrl && (
                    <img src={resolveImageSrc(post.sharedPost.imageUrl)} alt="Shared post" className="w-full max-h-72 object-cover" />
                  )}
                </div>
              </Link>
            ) : (
              <div className="mx-4 mb-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">This post is no longer available.</p>
              </div>
            )
          ) : (
            <>
              {mediaPhotos.length > 0 ? (
                <PhotoCarousel photos={mediaPhotos} alt={isBoat ? "Boat" : "Post photo"} />
              ) : null}
              {post.videoUrl && (
                <VideoPlayer src={resolveImageSrc(post.videoUrl)} className="w-full aspect-[4/3] max-h-[600px]" />
              )}
            </>
          )}
        </MatureGate>

        {isBoat && boatSpecs.length > 0 && (
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
            {boatSpecs.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <PollView post={post} votePoll={votePoll} queryClient={queryClient} getGetPostsQueryKey={getGetPostsQueryKey} getGetSavedPostsQueryKey={getGetSavedPostsQueryKey} />

        {likeTotal > 0 && (
          <div className="px-4 py-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLikes(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground group"
            >
              {topLikeEmojis.length > 0 && <span className="text-sm leading-none drop-shadow-sm group-hover:scale-110 transition-transform">{topLikeEmojis.join("")}</span>}
              <span className="font-medium">{likeTotal} {likeTotal === 1 ? "like" : "likes"}</span>
            </button>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-1.5 flex justify-between gap-1 border-t border-border/30">
        <ReactionButton post={post} onReact={onReact} />
        <Button variant="ghost" size="sm" className={`flex-1 font-semibold transition-colors hover:bg-muted/50 rounded-lg ${showComments ? 'text-primary bg-primary/5' : 'text-muted-foreground'}`} onClick={() => setShowComments(v => !v)}>
          <MessageCircle className="w-4 h-4 mr-2" /> 
          <span>{commentCount > 0 ? commentCount : "Comment"}</span>
        </Button>
        {post.pinLat != null && post.pinLng != null && (
          <Button asChild variant="ghost" size="sm" className="flex-1 font-semibold text-primary hover:bg-primary/5 rounded-lg">
            <Link href={`/map?lat=${post.pinLat}&lng=${post.pinLng}`}>
              <MapPin className="w-4 h-4 mr-2" /> 
              <span>Map</span>
            </Link>
          </Button>
        )}
      </CardFooter>

      {showComments && (
        <div className="bg-card px-4 pb-4 pt-1 space-y-4 rounded-b-[20px]">
          {comments && comments.length > 0 ? (
            comments.map((c: any) => (
              <div key={c.id} className="flex items-start gap-2.5 group animate-in fade-in duration-300">
                <Link href={`/profile/${c.userId}`} className="shrink-0">
                  <UserAvatar name={c.user?.displayName || "User"} username={c.user?.username || ""} avatarUrl={c.user?.avatarUrl} className="w-8 h-8 mt-0.5 cursor-pointer shadow-sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link href={`/profile/${c.userId}`}>
                        <span className="font-bold text-xs hover:underline cursor-pointer text-foreground">{c.user?.displayName || "User"}</span>
                      </Link>
                      <span className="text-[10px] text-muted-foreground font-medium">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                    </div>
                    <MatureGate isMature={c.isMature} label="Sensitive comment">
                      {c.content && <p className="text-sm whitespace-pre-wrap break-words text-foreground/90">{c.content}</p>}
                      {c.imageUrl && (
                        <div className="mt-2 rounded-xl overflow-hidden bg-muted relative aspect-video shadow-sm">
                          <ClickableImage src={resolveImageSrc(c.imageUrl)} alt="Comment attachment" className="w-full h-full object-cover" />
                        </div>
                      )}
                      {c.videoUrl && (
                        <div className="mt-2 rounded-xl overflow-hidden bg-black aspect-video shadow-sm">
                          <video src={resolveImageSrc(c.videoUrl)} controls className="w-full h-full" />
                        </div>
                      )}
                    </MatureGate>
                  </div>
                  <div className="mt-1.5 pl-2 flex items-center gap-3">
                    <CommentReactionButton comment={c} onReact={(r) => handleReactComment(c.id, r)} />
                  </div>
                </div>
                {currentUserId != null && c.userId === currentUserId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeComment(c.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm font-medium text-muted-foreground text-center py-4 bg-muted/20 rounded-xl">No comments yet. Be the first to say something.</p>
          )}

          {commentImageUrl && (
            <div className="relative rounded-xl overflow-hidden bg-muted shadow-sm aspect-video mt-2">
              <img src={`/api/storage${commentImageUrl}`} alt="Comment attachment" className="w-full h-full object-cover" />
              <div className="absolute right-2 top-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md border-none"
                  onClick={() => { setCommentImageUrl(null); if (commentImageInputRef.current) commentImageInputRef.current.value = ""; }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {commentVideoUrl && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video mt-2 shadow-sm">
              <video src={`/api/storage${commentVideoUrl}`} controls className="w-full h-full" />
              <div className="absolute right-2 top-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md border-none"
                  onClick={() => { setCommentVideoUrl(null); if (commentVideoInputRef.current) commentVideoInputRef.current.value = ""; }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border/40 mt-4">
            <input ref={commentImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCommentImageSelect} />
            <input ref={commentVideoInputRef} type="file" accept="video/*" className="hidden" onChange={handleCommentVideoSelect} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full shrink-0 h-10 w-10 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              disabled={isUploadingComment}
              onClick={() => commentImageInputRef.current?.click()}
              title="Add a photo"
            >
              <ImagePlus className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full shrink-0 h-10 w-10 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              disabled={isUploadingComment}
              onClick={() => commentVideoInputRef.current?.click()}
              title="Add a video"
            >
              <Video className="w-5 h-5" />
            </Button>
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitComment(); } }}
              placeholder={isUploadingComment ? "Uploading..." : "Write a comment..."}
              className="rounded-full border-border/60 bg-muted/30 shadow-none h-10 px-4 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button 
              size="icon" 
              className={`rounded-full shrink-0 h-10 w-10 shadow-sm transition-all ${commentText.trim() || commentImageUrl || commentVideoUrl ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={submitComment} 
              disabled={(!commentText.trim() && !commentImageUrl && !commentVideoUrl) || createComment.isPending || isUploadingComment}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        </div>
      )}

      <LikesDialog postId={post.id} open={showLikes} onOpenChange={setShowLikes} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" targetId={post.id} />
      <Dialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block {post.user?.displayName || "this user"}?</DialogTitle>
            <DialogDescription>
              They won't be able to see your posts or message you, and you won't see theirs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBlockConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setBlockConfirmOpen(false); onBlockUser(post.userId); }}>Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
