import React from "react";
import { useParams, Link } from "wouter";
import { useGetUser, useGetMe, useGetPosts, useGetPins, useGetGallery, useCreateGalleryItem, useDeleteGalleryItem, useFollowUser, useUnfollowUser, useBlockUser, useUnblockUser, useGetFriends, useGetFollowers, useGetFollowing, getGetUserQueryKey, getGetGalleryQueryKey, getGetFriendsQueryKey, getGetBlockedUsersQueryKey, getGetFollowersQueryKey, getGetFollowingQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Ship, UserMinus, UserPlus, ArrowLeft, Settings, MessageSquare, BadgeCheck, Lock, Globe, Users, ImagePlus, Plus, Play, Trash2, X, Clock, Ban, ShieldOff, Flag, Home, Briefcase, Cake, Heart, User2 } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import { BadgeRow } from "@/components/Badges";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar, resolveAvatarUrl } from "@/components/UserAvatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const BOAT_TYPE_LABELS: Record<string, string> = {
  speedboat: "Speed Boat",
  pontoon: "Pontoon",
  sailboat: "Sailboat",
  kayak: "Kayak",
  jetski: "Jet Ski",
  yacht: "Yacht",
};

function pinEmoji(type: string) {
  switch (type) {
    case "fishing_spot": return "🎣";
    case "marina": return "⛵";
    case "waterfall": return "💧";
    case "cliff": return "🏔️";
    case "campsite": return "🏕️";
    case "hazard": return "⚠️";
    default: return "📍";
  }
}

function PinVisibility({ visibility }: { visibility?: string }) {
  if (visibility === "public") {
    return <Badge variant="secondary" className="gap-1 text-[10px]"><Globe className="w-3 h-3" /> Public</Badge>;
  }
  if (visibility === "community") {
    return <Badge variant="secondary" className="gap-1 text-[10px]"><Users className="w-3 h-3" /> Community</Badge>;
  }
  return <Badge variant="secondary" className="gap-1 text-[10px]"><Lock className="w-3 h-3" /> Friends</Badge>;
}

function formatBirthday(value?: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function ProfileDetails({ user }: { user: any }) {
  const items: { icon: React.ReactNode; label: string }[] = [];
  if (user.location) items.push({ icon: <MapPin className="w-4 h-4 text-primary" />, label: `Lives in ${user.location}` });
  if (user.hometown) items.push({ icon: <Home className="w-4 h-4 text-primary" />, label: `From ${user.hometown}` });
  if (user.work) items.push({ icon: <Briefcase className="w-4 h-4 text-primary" />, label: user.work });
  const bday = formatBirthday(user.birthday);
  if (bday) items.push({ icon: <Cake className="w-4 h-4 text-primary" />, label: bday });
  if (user.relationshipStatus) items.push({ icon: <Heart className="w-4 h-4 text-primary" />, label: user.relationshipStatus });
  if (user.gender) items.push({ icon: <User2 className="w-4 h-4 text-primary" />, label: user.gender });
  if (items.length === 0) return null;
  return (
    <div className="mt-6 w-full max-w-sm mx-auto flex flex-col gap-2 px-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
          {item.icon}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function pinWindow(startTime?: string | null, endTime?: string | null) {
  if (!startTime && !endTime) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (startTime && endTime) return `${fmt(startTime)} - ${fmt(endTime)}`;
  if (startTime) return `From ${fmt(startTime)}`;
  return `Until ${fmt(endTime!)}`;
}

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { data: me } = useGetMe();

  const isSelf = userId === "me" || (me != null && parseInt(userId) === me.id);
  const id = isSelf ? me?.id ?? 0 : parseInt(userId);

  const { data: otherUser, isLoading: loadingOther } = useGetUser(id, {
    query: { queryKey: getGetUserQueryKey(id), enabled: !isSelf && !!id },
  });
  const user = isSelf ? me : otherUser;
  const loadingUser = isSelf ? !me : loadingOther;

  const { data: posts, isLoading: loadingPosts } = useGetPosts({});
  const { data: pins, isLoading: loadingPins } = useGetPins(
    id ? { profileUserId: id } : {},
    { query: { enabled: !!id } }
  );
  const { data: friends } = useGetFriends();
  const { data: gallery, isLoading: loadingGallery } = useGetGallery(
    id ? { profileUserId: id } : {},
    { query: { enabled: !!id } }
  );

  const queryClient = useQueryClient();
  const createGalleryItem = useCreateGalleryItem();
  const deleteGalleryItem = useDeleteGalleryItem();
  const { uploadFile, isUploading } = useUpload();
  const mediaInputRef = React.useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [mediaType, setMediaType] = React.useState<"image" | "video">("image");

  const refreshGallery = () =>
    queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey(id ? { profileUserId: id } : {}) });

  const resetGallery = () => {
    setCaption("");
    setMediaUrl(null);
    setMediaType("image");
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const handleMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Please choose a photo or video file.");
      return;
    }
    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const res = await uploadFile(toUpload);
      if (res?.objectPath) {
        setMediaUrl(res.objectPath);
        setMediaType(isVideo ? "video" : "image");
      } else {
        toast.error("Couldn't upload that file.");
      }
    } catch {
      toast.error("Couldn't upload that file.");
    }
  };

  const handleGallerySubmit = () => {
    if (!mediaUrl) {
      toast.error("Add a photo or video first.");
      return;
    }
    createGalleryItem.mutate(
      {
        data: {
          mediaUrl: `/api/storage${mediaUrl}`,
          mediaType,
          caption: caption.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Added to your gallery!");
          setGalleryOpen(false);
          resetGallery();
          refreshGallery();
        },
        onError: () => toast.error("Couldn't add that to your gallery."),
      }
    );
  };

  const handleGalleryDelete = (itemId: number) => {
    deleteGalleryItem.mutate(
      { itemId },
      {
        onSuccess: () => { toast.success("Removed."); refreshGallery(); },
        onError: () => toast.error("Couldn't remove that item."),
      }
    );
  };

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const blockUser = useBlockUser();
  const [reportOpen, setReportOpen] = React.useState(false);
  const unblockUser = useUnblockUser();

  const refreshRelationship = () => {
    queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBlockedUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFollowersQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetFollowingQueryKey(id) });
  };

  const [followList, setFollowList] = React.useState<"followers" | "following" | null>(null);
  const [photoView, setPhotoView] = React.useState<{ src: string; alt: string } | null>(null);
  const friendStatus = (otherUser as any)?.friendStatus as string | undefined;
  const isFriend = friendStatus ? friendStatus === "accepted" : friends?.some((f) => f.id === id);
  const isBlocked = friendStatus === "blocked";
  const isPending = friendStatus === "pending_out";
  const showFollowers = (otherUser as any)?.showFollowers;
  const canViewFollows = isSelf || showFollowers !== false;
  const userPosts = posts?.filter((p) => p.userId === id);
  const userPins = pins?.filter((p) => p.userId === id);

  const handleFollow = () =>
    followUser.mutate({ userId: id }, { onSuccess: refreshRelationship });
  const handleUnfollow = () =>
    unfollowUser.mutate({ userId: id }, { onSuccess: refreshRelationship, onError: () => toast.error("Couldn't update.") });
  const handleBlock = () =>
    blockUser.mutate({ userId: id }, {
      onSuccess: () => { toast.success("User blocked."); refreshRelationship(); },
      onError: () => toast.error("Couldn't block this user."),
    });
  const handleUnblock = () =>
    unblockUser.mutate({ userId: id }, {
      onSuccess: () => { toast.success("User unblocked."); refreshRelationship(); },
      onError: () => toast.error("Couldn't unblock this user."),
    });

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="p-4 flex items-center gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <Button size="icon" variant="ghost" asChild className="-ml-2 shrink-0">
          <Link href={isSelf ? "/" : "/friends"}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-lg font-bold">{isSelf ? "My Profile" : "Profile"}</h1>
        {isSelf && (
          <Button size="icon" variant="ghost" asChild className="ml-auto shrink-0">
            <Link href="/settings"><Settings className="w-5 h-5" /></Link>
          </Button>
        )}
      </div>

      {loadingUser ? (
        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="w-24 h-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ) : user ? (
        <div className="flex flex-col items-center bg-card border-b border-border shadow-sm">
          <div className="w-full h-36 bg-gradient-to-br from-primary/30 to-primary/10 relative">
            {user.coverUrl && (
              <button
                type="button"
                onClick={() => setPhotoView({ src: `/api/storage${user.coverUrl}`, alt: "Cover photo" })}
                className="w-full h-full cursor-zoom-in"
                aria-label="View cover photo"
              >
                <img src={`/api/storage${user.coverUrl}`} alt="Cover photo" className="w-full h-full object-cover" />
              </button>
            )}
          </div>
          <div className="flex flex-col items-center px-6 pb-6 -mt-12 w-full">
          {user.avatarUrl ? (
            <button
              type="button"
              onClick={() => {
                const src = resolveAvatarUrl(user.avatarUrl);
                if (src) setPhotoView({ src, alt: "Profile photo" });
              }}
              className="cursor-zoom-in rounded-full"
              aria-label="View profile photo"
            >
              <UserAvatar
                name={user.displayName}
                username={user.username}
                avatarUrl={user.avatarUrl}
                online={user.isOnline}
                className="w-24 h-24 mb-4 ring-4 ring-card"
              />
            </button>
          ) : (
            <UserAvatar
              name={user.displayName}
              username={user.username}
              avatarUrl={user.avatarUrl}
              online={user.isOnline}
              className="w-24 h-24 mb-4 ring-4 ring-card"
            />
          )}

          <h2 className="text-2xl font-bold flex items-center gap-1.5">
            {user.displayName}
            {user.isBusiness && <BadgeCheck className="w-5 h-5 text-primary" />}
          </h2>
          <p className="text-muted-foreground mb-4">@{user.username}</p>

          <div className="flex items-center gap-4 mb-6 text-sm">
            {canViewFollows ? (
              <button type="button" className="text-center transition-opacity hover:opacity-70" onClick={() => setFollowList("followers")}>
                <div className="font-bold">{user.followerCount || 0}</div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Followers</div>
              </button>
            ) : (
              <div className="text-center">
                <div className="font-bold">{user.followerCount || 0}</div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Followers</div>
              </div>
            )}
            <div className="w-px h-8 bg-border" />
            {canViewFollows ? (
              <button type="button" className="text-center transition-opacity hover:opacity-70" onClick={() => setFollowList("following")}>
                <div className="font-bold">{user.followingCount || 0}</div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Following</div>
              </button>
            ) : (
              <div className="text-center">
                <div className="font-bold">{user.followingCount || 0}</div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Following</div>
              </div>
            )}
          </div>

          <FollowListDialog
            userId={id}
            mode={followList}
            onOpenChange={(open) => { if (!open) setFollowList(null); }}
          />

          <div className="flex flex-col gap-2 w-full max-w-xs">
            {isSelf ? (
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/settings"><Settings className="w-4 h-4 mr-2" /> Edit Profile</Link>
              </Button>
            ) : isBlocked ? (
              <Button variant="outline" className="flex-1" onClick={handleUnblock} disabled={unblockUser.isPending}>
                <ShieldOff className="w-4 h-4 mr-2" /> Unblock
              </Button>
            ) : (
              <>
                <div className="flex gap-2 w-full">
                  {isFriend ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <UserMinus className="w-4 h-4 mr-2" /> Unfriend
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unfriend {user.displayName}?</AlertDialogTitle>
                          <AlertDialogDescription>You'll no longer be connected on the lake.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleUnfollow}>Unfriend</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : isPending ? (
                    <Button variant="outline" className="flex-1" onClick={handleUnfollow} disabled={unfollowUser.isPending}>
                      <Clock className="w-4 h-4 mr-2" /> Requested
                    </Button>
                  ) : (
                    <Button className="flex-1" onClick={handleFollow} disabled={followUser.isPending}>
                      <UserPlus className="w-4 h-4 mr-2" /> Follow
                    </Button>
                  )}
                  <Button variant="secondary" className="flex-1" asChild>
                    <Link href={`/messages?user=${id}`}><MessageSquare className="w-4 h-4 mr-2" /> Message</Link>
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setReportOpen(true)}>
                    <Flag className="w-4 h-4 mr-2" /> Report
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        <Ban className="w-4 h-4 mr-2" /> Block
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Block {user.displayName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They won't be able to follow you, and you'll remove any existing connection. You can unblock them later from Settings.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Block
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>

          <BadgeRow badges={(user as any).badges} />

          {user.bio && (
            <p className="mt-6 text-center text-sm px-4 whitespace-pre-wrap">{user.bio}</p>
          )}

          <ProfileDetails user={user} />

          {user.boatName && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm bg-muted/50 px-4 py-2 rounded-full border border-border/50">
              <Ship className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Vessel:</span>
              <span className="text-muted-foreground">{user.boatName}</span>
              <span className="text-muted-foreground">· {BOAT_TYPE_LABELS[user.boatType ?? ""] ?? "Speed Boat"}</span>
              {user.boatColor && (
                <div className="w-3 h-3 rounded-full ml-1" style={{ backgroundColor: user.boatColor }} />
              )}
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-muted-foreground">User not found</div>
      )}

      <div className="p-4 flex-1">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
            <TabsTrigger value="pins" className="flex-1">Pins</TabsTrigger>
            <TabsTrigger value="gallery" className="flex-1">Gallery</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {loadingPosts ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : userPosts?.length ? (
              userPosts.map((post) => (
                <Card key={post.id} className="border-border/50">
                  <CardContent className="p-4">
                    <h3 className="font-bold">{post.title}</h3>
                    <p className="text-sm mt-1">{post.content}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                {isSelf ? "You haven't posted yet." : "No posts yet."}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pins" className="space-y-4">
            {loadingPins ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : userPins?.length ? (
              userPins.map((pin) => {
                const window = pinWindow(pin.startTime, pin.endTime);
                const canLocate = pin.lat != null && pin.lng != null;
                const card = (
                  <Card key={pin.id} className={`border-border/50 ${canLocate ? "transition-colors hover:bg-muted/40 cursor-pointer" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-xl">
                        {pinEmoji(pin.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm">{pin.title}</h3>
                          <PinVisibility visibility={pin.visibility} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{pin.description}</p>
                        {window && <p className="text-[11px] text-primary font-medium mt-0.5">{window}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
                return canLocate ? (
                  <Link key={pin.id} href={`/map?lat=${pin.lat}&lng=${pin.lng}`} className="block">
                    {card}
                  </Link>
                ) : card;
              })
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                {isSelf ? "You haven't dropped any pins." : "No pins dropped."}
              </div>
            )}
          </TabsContent>

          <TabsContent value="gallery" className="space-y-4">
            {isSelf && (
              <>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleMedia}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setGalleryOpen(true)}
                >
                  <ImagePlus className="w-4 h-4 mr-2" /> Add photos and videos
                </Button>
              </>
            )}

            {loadingGallery ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                ))}
              </div>
            ) : gallery?.length ? (
              <div className="grid grid-cols-3 gap-1.5">
                {gallery.map((item) => (
                  <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                    {item.mediaType === "video" ? (
                      <>
                        <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/40 rounded-full p-2">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img src={item.mediaUrl} alt={item.caption ?? "Gallery item"} className="w-full h-full object-cover" />
                    )}
                    {isSelf && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this item?</AlertDialogTitle>
                            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleGalleryDelete(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                {isSelf ? "Add your first photos and videos." : "No photos or videos yet."}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={galleryOpen} onOpenChange={(o) => { setGalleryOpen(o); if (!o) resetGallery(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to gallery</DialogTitle>
            <DialogDescription>Share a photo or video on your profile.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Photo or video</Label>
              {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                  {mediaType === "video" ? (
                    <video src={`/api/storage${mediaUrl}`} className="object-cover w-full h-full" controls playsInline />
                  ) : (
                    <img src={`/api/storage${mediaUrl}`} alt="Preview" className="object-cover w-full h-full" />
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => { setMediaUrl(null); if (mediaInputRef.current) mediaInputRef.current.value = ""; }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Choose photo or video"}
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption (optional)" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setGalleryOpen(false); resetGallery(); }}>Cancel</Button>
            <Button onClick={handleGallerySubmit} disabled={createGalleryItem.isPending || isUploading || !mediaUrl}>
              {createGalleryItem.isPending ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={id} />

      <ImageLightbox src={photoView?.src ?? null} alt={photoView?.alt ?? ""} open={!!photoView} onClose={() => setPhotoView(null)} />
    </div>
  );
}

function FollowListDialog({
  userId,
  mode,
  onOpenChange,
}: {
  userId: number;
  mode: "followers" | "following" | null;
  onOpenChange: (open: boolean) => void;
}) {
  const followers = useGetFollowers(userId, { query: { enabled: mode === "followers" } });
  const following = useGetFollowing(userId, { query: { enabled: mode === "following" } });
  const active = mode === "followers" ? followers : following;
  const list = active.data;
  const isLoading = active.isLoading;
  const isError = active.isError;

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "followers" ? "Followers" : "Following"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground text-center py-8">This list is private.</p>
          ) : !list || list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          ) : (
            <div className="space-y-1 py-1">
              {list.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl ?? undefined} className="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {u.displayName}
                      {u.isBusiness && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
