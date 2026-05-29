import React from "react";
import { useParams, Link } from "wouter";
import { useGetUser, useGetPosts, useGetPins, useFollowUser, useUnfollowUser, useGetFriends } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Ship, UserMinus, UserPlus, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const id = parseInt(userId);
  
  const { data: user, isLoading: loadingUser } = useGetUser(id);
  const { data: posts, isLoading: loadingPosts } = useGetPosts({}); // Filtering by user usually, but assuming API handles or we filter client side
  const { data: pins, isLoading: loadingPins } = useGetPins({});
  const { data: friends } = useGetFriends();
  
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const isFriend = friends?.some(f => f.id === id);
  const userPosts = posts?.filter(p => p.userId === id);
  const userPins = pins?.filter(p => p.userId === id);

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="p-4 flex items-center gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <Button size="icon" variant="ghost" asChild className="-ml-2 shrink-0">
          <Link href="/friends"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-lg font-bold">Profile</h1>
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
        <div className="flex flex-col items-center p-6 bg-card border-b border-border shadow-sm">
          <div className="relative mb-4">
            <img 
              src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} 
              className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-md" 
              alt={user.displayName} 
            />
            {user.isOnline && (
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold">{user.displayName}</h2>
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
              <Link href={`/messages?user=${id}`}>Message</Link>
            </Button>
          </div>
          
          {user.bio && (
            <p className="mt-6 text-center text-sm px-4 whitespace-pre-wrap">{user.bio}</p>
          )}

          {user.boatName && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm bg-muted/50 px-4 py-2 rounded-full border border-border/50">
              <Ship className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Vessel:</span>
              <span className="text-muted-foreground">{user.boatName}</span>
              {user.boatColor && (
                <div className="w-3 h-3 rounded-full ml-1" style={{ backgroundColor: user.boatColor }} />
              )}
            </div>
          )}
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
              userPosts.map(post => (
                <Card key={post.id} className="border-border/50">
                  <CardContent className="p-4">
                    <h3 className="font-bold">{post.title}</h3>
                    <p className="text-sm mt-1">{post.content}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">No posts yet.</div>
            )}
          </TabsContent>
          
          <TabsContent value="pins" className="space-y-4">
            {loadingPins ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : userPins?.length ? (
              userPins.map(pin => (
                <Card key={pin.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-xl">
                      {pin.type === 'fishing_spot' ? '🎣' : pin.type === 'marina' ? '⛵' : '📍'}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{pin.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{pin.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">No pins dropped.</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
