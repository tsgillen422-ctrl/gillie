import React from "react";
import { useGetFriends, useGetFriendRequests, useSearchUsers, useFollowUser, useUnfollowUser, useAcceptFriendRequest } from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Check, X, UserMinus, Navigation, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export function FriendsPage() {
  const [search, setSearch] = React.useState("");
  const { data: friends, isLoading: loadingFriends } = useGetFriends();
  const { data: requests, isLoading: loadingRequests } = useGetFriendRequests();
  const { data: searchResults, isLoading: loadingSearch } = useSearchUsers({ q: search }, { query: { enabled: search.length > 2 } });
  
  const acceptRequest = useAcceptFriendRequest();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm z-10 sticky top-0">
        <h1 className="text-2xl font-bold text-primary mb-4">Friends</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Find friends on the lake..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-none"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {search.length > 2 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Search Results</h2>
            {loadingSearch ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : searchResults?.length ? (
              searchResults.map(user => (
                <UserCard key={user.id} user={user} action={
                  <Button size="sm" variant="secondary" onClick={() => followUser.mutate({ userId: user.id })}>
                    <UserPlus className="w-4 h-4 mr-1" /> Add
                  </Button>
                } />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No users found.</p>
            )}
          </div>
        ) : (
          <Tabs defaultValue="friends" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="friends" className="flex-1">My Crew</TabsTrigger>
              <TabsTrigger value="requests" className="flex-1 relative">
                Requests
                {requests && requests.length > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="friends" className="space-y-4 m-0">
              {loadingFriends ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : friends?.length ? (
                friends.map(friend => (
                  <UserCard key={friend.id} user={friend} action={
                    <div className="flex gap-2">
                      {friend.isOnline && friend.currentLat && (
                        <Button size="icon" variant="outline" className="h-8 w-8 text-primary border-primary/20 bg-primary/5" asChild>
                          <Link href={`/map?lat=${friend.currentLat}&lng=${friend.currentLng}`}>
                            <Navigation className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => unfollowUser.mutate({ userId: friend.id })}>
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  } />
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">No friends yet</h3>
                  <p className="text-muted-foreground text-sm">Search above to find people you know on the lake.</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="requests" className="space-y-4 m-0">
              {loadingRequests ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : requests?.length ? (
                requests.map(req => (
                  <UserCard key={req.id} user={req.follower!} action={
                    <div className="flex gap-2">
                      <Button size="icon" variant="default" className="h-8 w-8 rounded-full" onClick={() => acceptRequest.mutate({ requestId: req.id, data: { status: 'accepted' } })}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => acceptRequest.mutate({ requestId: req.id, data: { status: 'rejected' } })}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  } />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-12">No pending requests.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function UserCard({ user, action }: { user: any, action?: React.ReactNode }) {
  return (
    <Card className="hover-elevate overflow-hidden border-border/50">
      <CardContent className="p-3 flex items-center gap-3">
        <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} online={user.isOnline} className="w-12 h-12" />
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${user.id}`} className="font-semibold text-foreground truncate hover:underline block">
            {user.displayName}
          </Link>
          <div className="flex items-center text-xs text-muted-foreground mt-0.5">
            <span className="truncate">{user.boatName || `@${user.username}`}</span>
          </div>
        </div>
        {action && <div>{action}</div>}
      </CardContent>
    </Card>
  );
}
