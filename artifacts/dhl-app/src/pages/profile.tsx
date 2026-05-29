import React from "react";
import { useParams, Link } from "wouter";
import { useGetUser, useGetMe, useGetPosts, useGetPins, useFollowUser, useUnfollowUser, useGetFriends, getGetUserQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Ship, UserMinus, UserPlus, ArrowLeft, Settings, MessageSquare, BadgeCheck, Lock, Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";

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

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const isFriend = friends?.some((f) => f.id === id);
  const userPosts = posts?.filter((p) => p.userId === id);
  const userPins = pins?.filter((p) => p.userId === id);

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
              <img src={`/api/storage${user.coverUrl}`} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex flex-col items-center px-6 pb-6 -mt-12 w-full">
          <UserAvatar
            name={user.displayName}
            username={user.username}
            avatarUrl={user.avatarUrl}
            online={user.isOnline}
            className="w-24 h-24 mb-4 ring-4 ring-card"
          />

          <h2 className="text-2xl font-bold flex items-center gap-1.5">
            {user.displayName}
            {user.isBusiness && <BadgeCheck className="w-5 h-5 text-primary" />}
          </h2>
          <p className="text-muted-foreground mb-4">@{user.username}</p>

          <div className="flex items-center gap-4 mb-6 text-sm">
            <div className="text-center">
              <div className="font-bold">{user.followerCount || 0}</div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">Followers</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="font-bold">{user.followingCount || 0}</div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">Following</div>
            </div>
          </div>

          <div className="flex gap-2 w-full max-w-xs">
            {isSelf ? (
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/settings"><Settings className="w-4 h-4 mr-2" /> Edit Profile</Link>
              </Button>
            ) : (
              <>
                {isFriend ? (
                  <Button variant="outline" className="flex-1" onClick={() => unfollowUser.mutate({ userId: id })}>
                    <UserMinus className="w-4 h-4 mr-2" /> Unfollow
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={() => followUser.mutate({ userId: id })}>
                    <UserPlus className="w-4 h-4 mr-2" /> Follow
                  </Button>
                )}
                <Button variant="secondary" className="flex-1" asChild>
                  <Link href={`/messages?user=${id}`}><MessageSquare className="w-4 h-4 mr-2" /> Message</Link>
                </Button>
              </>
            )}
          </div>

          {user.bio && (
            <p className="mt-6 text-center text-sm px-4 whitespace-pre-wrap">{user.bio}</p>
          )}

          {user.boatName && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm bg-muted/50 px-4 py-2 rounded-full border border-border/50">
              <Ship className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Vessel:</span>
              <span className="text-muted-foreground">{user.boatName}</span>
              <span className="text-muted-foreground">· {user.boatType === "pontoon" ? "Pontoon" : "Speed Boat"}</span>
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
                return (
                  <Card key={pin.id} className="border-border/50">
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
              })
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                {isSelf ? "You haven't dropped any pins." : "No pins dropped."}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
