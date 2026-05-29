import React from "react";
import { useGetPosts, useGetPostsSummary, useLikePost } from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Calendar, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function FeedPage() {
  const [activeTab, setActiveTab] = React.useState<"all" | "post" | "event" | "business">("all");
  
  const { data: posts, isLoading } = useGetPosts(
    activeTab !== "all" ? { type: activeTab } : {}
  );
  
  const { data: summary } = useGetPostsSummary();
  const likePost = useLikePost();

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
            <PostCard key={post.id} post={post} onLike={() => likePost.mutate({ postId: post.id })} />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No posts in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, onLike }: { post: any, onLike: () => void }) {
  const isEvent = post.postType === "event";
  
  return (
    <Card className="border-border/60 hover-elevate overflow-hidden bg-card">
      <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
        <UserAvatar name={post.user?.displayName || "User"} username={post.user?.username || ""} avatarUrl={post.user?.avatarUrl} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm truncate">{post.user?.displayName}</h3>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
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
        
        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
        
        {post.imageUrl && (
          <div className="mt-3 rounded-xl overflow-hidden bg-muted relative aspect-video">
            <img src={post.imageUrl} alt="Post content" className="object-cover w-full h-full" />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-2 border-t border-border/40 flex justify-between bg-muted/10">
        <Button variant="ghost" size="sm" className={`flex-1 text-muted-foreground ${post.likedByMe ? 'text-destructive' : ''}`} onClick={onLike}>
          <Heart className={`w-4 h-4 mr-2 ${post.likedByMe ? 'fill-destructive text-destructive' : ''}`} /> 
          {post.likeCount || 0}
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground">
          <MessageCircle className="w-4 h-4 mr-2" /> Comment
        </Button>
        {post.pinLat && post.pinLng && (
          <Button variant="ghost" size="sm" className="flex-1 text-primary">
            <MapPin className="w-4 h-4 mr-2" /> Map
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
