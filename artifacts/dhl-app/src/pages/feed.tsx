import React from "react";
import { useGetPosts, useGetPostsSummary, useReactToPost, useGetMe, useDeletePost, useCreatePost, useGetPostComments, useCreatePostComment, useDeletePostComment, useToggleRsvp, getGetPostsQueryKey, getGetPostsSummaryQueryKey, getGetPostCommentsQueryKey } from "@workspace/api-client-react";
import { PostInputPostType } from "@workspace/api-client-react/src/generated/api.schemas";
import { UserAvatar } from "@/components/UserAvatar";
import { ConditionsWidget } from "@/components/ConditionsWidget";
import { HazardBanner } from "@/components/HazardBanner";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Heart, MessageCircle, Share2, Calendar, MapPin, Trash2, Plus, ImagePlus, X, Send, Video, Check, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { REACTIONS, REACTION_MAP, DEFAULT_REACTION, type ReactionKey } from "@/lib/reactions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function FeedPage() {
  const [activeTab, setActiveTab] = React.useState<"all" | "post" | "event" | "business">("all");
  
  const { data: posts, isLoading } = useGetPosts(
    activeTab !== "all" ? { type: activeTab } : {}
  );
  
  const { data: summary } = useGetPostsSummary();
  const { data: me } = useGetMe();
  const reactPost = useReactToPost();
  const deletePost = useDeletePost();
  const createPost = useCreatePost();
  const queryClient = useQueryClient();

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");
  const [newType, setNewType] = React.useState<"post" | "event" | "business">("post");
  const [newEventDate, setNewEventDate] = React.useState("");
  const [newImageUrl, setNewImageUrl] = React.useState<string | null>(null);
  const [newVideoUrl, setNewVideoUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();

  const refreshPosts = () => {
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPostsSummaryQueryKey() });
  };

  const handleDeletePost = (postId: number) => {
    deletePost.mutate(
      { postId },
      {
        onSuccess: () => {
          toast.success("Post deleted.");
          refreshPosts();
        },
        onError: () => toast.error("Couldn't delete that post."),
      }
    );
  };

  const resetComposer = () => {
    setNewTitle("");
    setNewContent("");
    setNewType("post");
    setNewEventDate("");
    setNewImageUrl(null);
    setNewVideoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      const res = await uploadFile(await compressImage(file));
      if (res?.objectPath) {
        setNewImageUrl(res.objectPath);
        setNewVideoUrl(null);
        if (videoInputRef.current) videoInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that photo.");
      }
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    try {
      const res = await uploadFile(file);
      if (res?.objectPath) {
        setNewVideoUrl(res.objectPath);
        setNewImageUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that video.");
      }
    } catch {
      toast.error("Couldn't upload that video.");
    }
  };

  const handleCreatePost = () => {
    if (!newContent.trim()) {
      toast.error("Add some content for your post.");
      return;
    }
    if (newType === "event" && !newEventDate) {
      toast.error("Pick a date for your event.");
      return;
    }
    createPost.mutate(
      {
        data: {
          title: newTitle.trim() || (newType === "event" ? "Event" : "Post"),
          content: newContent.trim(),
          postType: newType as PostInputPostType,
          eventDate: newType === "event" && newEventDate ? new Date(newEventDate).toISOString() : undefined,
          imageUrl: newImageUrl ? `/api/storage${newImageUrl}` : undefined,
          videoUrl: newVideoUrl ? `/api/storage${newVideoUrl}` : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Post shared!");
          setComposerOpen(false);
          resetComposer();
          refreshPosts();
        },
        onError: () => toast.error("Couldn't share your post."),
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-primary mb-2">Community Feed</h1>
        
        {/* Quick stats / vibe setter */}
        {summary && (
          <div className="flex gap-4 mb-4 text-sm text-muted-foreground overflow-x-auto pb-1 no-scrollbar whitespace-nowrap">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {summary.activeUsersToday} on the lake</div>
            <div className="flex items-center gap-1.5">📅 {summary.totalEvents} events this week</div>
            <div className="flex items-center gap-1.5">📍 {summary.totalPins} active pins</div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="post" className="flex-1">Social</TabsTrigger>
            <TabsTrigger value="event" className="flex-1">Events</TabsTrigger>
            <TabsTrigger value="business" className="flex-1">Local</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <HazardBanner />
        <ConditionsWidget />
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader className="flex flex-row items-center gap-4 p-4 pb-2">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : posts?.length ? (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onReact={(reaction) => reactPost.mutate({ postId: post.id, data: { reaction } }, { onSuccess: refreshPosts })}
              canDelete={me != null && post.userId === me.id}
              onDelete={() => handleDeletePost(post.id)}
              currentUserId={me?.id}
            />
          ))
        ) : (
          <div className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Nothing here yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Be the first to share what's happening on the lake. Tap the + button to post.
            </p>
          </div>
        )}
      </div>

      {me && (
        <div className="absolute bottom-6 right-6 z-20">
          <Button
            onClick={() => setComposerOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="New post"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      <Dialog open={composerOpen} onOpenChange={(open) => { setComposerOpen(open); if (!open) resetComposer(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
            <DialogDescription>Share something with the Dale Hollow community.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Social</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="business">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Add a title (optional)" />
            </div>

            <div className="space-y-1.5">
              <Label>What's happening?</Label>
              <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Share an update..." rows={4} />
            </div>

            {newType === "event" && (
              <div className="space-y-1.5">
                <Label>Event date</Label>
                <Input type="datetime-local" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Photo or video</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
              {newImageUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                  <img src={`/api/storage${newImageUrl}`} alt="Selected" className="object-cover w-full h-full" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => { setNewImageUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : newVideoUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video src={`/api/storage${newVideoUrl}`} controls className="w-full h-full" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => { setNewVideoUrl(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="w-4 h-4 mr-2" />
                    {isUploading ? "Uploading..." : "Add a photo"}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" disabled={isUploading} onClick={() => videoInputRef.current?.click()}>
                    <Video className="w-4 h-4 mr-2" />
                    {isUploading ? "Uploading..." : "Add a video"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setComposerOpen(false); resetComposer(); }}>Cancel</Button>
            <Button onClick={handleCreatePost} disabled={createPost.isPending || isUploading}>
              {createPost.isPending ? "Sharing..." : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReactionButton({ post, onReact }: { post: any, onReact: (reaction: ReactionKey) => void }) {
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
          <div className="absolute bottom-full left-0 mb-2 z-50 flex gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-xl">
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
        className={`w-full select-none text-muted-foreground ${current ? "text-primary font-medium" : ""}`}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
      >
        {current ? (
          <span className="mr-2 text-base leading-none">{current.emoji}</span>
        ) : topEmojis.length > 0 ? (
          <span className="mr-2 text-base leading-none">{topEmojis.join("")}</span>
        ) : (
          <Heart className="w-4 h-4 mr-2" />
        )}
        {total}
      </Button>
    </div>
  );
}

function PostCard({ post, onReact, canDelete, onDelete, currentUserId }: { post: any, onReact: (reaction: ReactionKey) => void, canDelete?: boolean, onDelete?: () => void, currentUserId?: number }) {
  const isEvent = post.postType === "event";
  const [showComments, setShowComments] = React.useState(false);
  const { data: comments } = useGetPostComments(post.id, { query: { enabled: showComments } });
  const createComment = useCreatePostComment();
  const deleteComment = useDeletePostComment();
  const toggleRsvp = useToggleRsvp();
  const queryClient = useQueryClient();

  const handleRsvp = () => {
    toggleRsvp.mutate(
      { postId: post.id },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() }),
        onError: () => toast.error("Couldn't update your RSVP."),
      }
    );
  };
  const [commentText, setCommentText] = React.useState("");
  const [commentImageUrl, setCommentImageUrl] = React.useState<string | null>(null);
  const [commentVideoUrl, setCommentVideoUrl] = React.useState<string | null>(null);
  const commentImageInputRef = React.useRef<HTMLInputElement>(null);
  const commentVideoInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadFile: uploadCommentFile, isUploading: isUploadingComment } = useUpload();

  const refreshComments = () => {
    queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(post.id) });
  };

  const handleCommentImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo.");
      return;
    }
    try {
      const compressed = await compressImage(file);
      const res = await uploadCommentFile(compressed);
      if (res?.objectPath) {
        setCommentImageUrl(res.objectPath);
        setCommentVideoUrl(null);
        if (commentVideoInputRef.current) commentVideoInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that photo.");
      }
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  };

  const handleCommentVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    try {
      const res = await uploadCommentFile(file);
      if (res?.objectPath) {
        setCommentVideoUrl(res.objectPath);
        setCommentImageUrl(null);
        if (commentImageInputRef.current) commentImageInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that video.");
      }
    } catch {
      toast.error("Couldn't upload that video.");
    }
  };

  const submitComment = () => {
    if (!commentText.trim() && !commentImageUrl && !commentVideoUrl) return;
    createComment.mutate(
      {
        postId: post.id,
        data: {
          content: commentText.trim() || undefined,
          imageUrl: commentImageUrl ? `/api/storage${commentImageUrl}` : undefined,
          videoUrl: commentVideoUrl ? `/api/storage${commentVideoUrl}` : undefined,
        },
      },
      {
        onSuccess: () => {
          setCommentText("");
          setCommentImageUrl(null);
          setCommentVideoUrl(null);
          if (commentImageInputRef.current) commentImageInputRef.current.value = "";
          if (commentVideoInputRef.current) commentVideoInputRef.current.value = "";
          refreshComments();
        },
        onError: () => toast.error("Couldn't post your comment."),
      }
    );
  };

  const removeComment = (commentId: number) => {
    deleteComment.mutate(
      { postId: post.id, commentId },
      { onSuccess: refreshComments, onError: () => toast.error("Couldn't delete that comment.") }
    );
  };

  const commentCount = comments?.length ?? 0;

  return (
    <Card className="border-border/60 hover-elevate overflow-hidden bg-card">
      <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
        <UserAvatar name={post.user?.displayName || "User"} username={post.user?.username || ""} avatarUrl={post.user?.avatarUrl} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm truncate">{post.user?.displayName}</h3>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </span>
              {canDelete && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                      <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          {post.user?.boatName && <p className="text-xs text-muted-foreground truncate">{post.user.boatName}</p>}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-2">
        {post.title && <h4 className="font-bold text-lg mb-1">{post.title}</h4>}
        
        {isEvent && post.eventDate && (
          <div className="flex items-center gap-2 text-sm text-accent-foreground bg-accent/20 px-3 py-2 rounded-md mb-3 font-medium">
            <Calendar className="w-4 h-4 text-accent" />
            {new Date(post.eventDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        )}

        {isEvent && (
          <div className="flex items-center gap-3 mb-3">
            <Button
              type="button"
              size="sm"
              variant={post.rsvpByMe ? "default" : "outline"}
              onClick={handleRsvp}
              disabled={toggleRsvp.isPending}
            >
              {post.rsvpByMe ? <Check className="w-4 h-4 mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
              {post.rsvpByMe ? "Going" : "RSVP"}
            </Button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {post.rsvpCount || 0} going
            </span>
          </div>
        )}
        
        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
        
        {post.imageUrl && (
          <div className="mt-3 rounded-xl overflow-hidden bg-muted relative aspect-video">
            <img src={post.imageUrl} alt="Post content" className="object-cover w-full h-full" />
          </div>
        )}

        {post.videoUrl && (
          <div className="mt-3 rounded-xl overflow-hidden bg-black relative aspect-video">
            <video src={post.videoUrl} controls className="w-full h-full" />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-2 border-t border-border/40 flex justify-between bg-muted/10">
        <ReactionButton post={post} onReact={onReact} />
        <Button variant="ghost" size="sm" className={`flex-1 text-muted-foreground ${showComments ? 'text-primary' : ''}`} onClick={() => setShowComments(v => !v)}>
          <MessageCircle className="w-4 h-4 mr-2" /> {commentCount > 0 ? commentCount : "Comment"}
        </Button>
        {post.pinLat != null && post.pinLng != null && (
          <Button asChild variant="ghost" size="sm" className="flex-1 text-primary">
            <Link href={`/map?lat=${post.pinLat}&lng=${post.pinLng}`}>
              <MapPin className="w-4 h-4 mr-2" /> Map
            </Link>
          </Button>
        )}
      </CardFooter>

      {showComments && (
        <div className="border-t border-border/40 bg-muted/5 p-4 space-y-3">
          {comments && comments.length > 0 ? (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 group">
                <UserAvatar name={c.user?.displayName || "User"} username={c.user?.username || ""} avatarUrl={c.user?.avatarUrl} className="w-7 h-7 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="bg-muted rounded-2xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs">{c.user?.displayName || "User"}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                    </div>
                    {c.content && <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>}
                    {c.imageUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden bg-muted">
                        <img src={c.imageUrl} alt="Comment attachment" className="w-full h-auto" />
                      </div>
                    )}
                    {c.videoUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden bg-black aspect-video">
                        <video src={c.videoUrl} controls className="w-full h-full" />
                      </div>
                    )}
                  </div>
                </div>
                {currentUserId != null && c.userId === currentUserId && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeComment(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first to say something.</p>
          )}

          {commentImageUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted">
              <img src={`/api/storage${commentImageUrl}`} alt="Comment attachment" className="w-full h-auto" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => { setCommentImageUrl(null); if (commentImageInputRef.current) commentImageInputRef.current.value = ""; }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {commentVideoUrl && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video src={`/api/storage${commentVideoUrl}`} controls className="w-full h-full" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => { setCommentVideoUrl(null); if (commentVideoInputRef.current) commentVideoInputRef.current.value = ""; }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input ref={commentImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCommentImageSelect} />
            <input ref={commentVideoInputRef} type="file" accept="video/*" className="hidden" onChange={handleCommentVideoSelect} />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full shrink-0"
              disabled={isUploadingComment}
              onClick={() => commentImageInputRef.current?.click()}
              title="Add a photo"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full shrink-0"
              disabled={isUploadingComment}
              onClick={() => commentVideoInputRef.current?.click()}
              title="Add a video"
            >
              <Video className="w-4 h-4" />
            </Button>
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitComment(); } }}
              placeholder={isUploadingComment ? "Uploading..." : "Add a comment..."}
              className="rounded-full"
            />
            <Button size="icon" className="rounded-full shrink-0" onClick={submitComment} disabled={(!commentText.trim() && !commentImageUrl && !commentVideoUrl) || createComment.isPending || isUploadingComment}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
