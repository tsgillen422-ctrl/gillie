import React from "react";
import { useGetConversations, useSearchUsers, useCreateConversation } from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, MessageSquarePlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function MessagesPage() {
  const [search, setSearch] = React.useState("");
  const { data: conversations, isLoading } = useGetConversations();
  const [, setLocation] = useLocation();
  const createConv = useCreateConversation();
  const { data: searchResults } = useSearchUsers({ q: search }, { query: { enabled: search.length > 2 } });

  const startConversation = (userId: number) => {
    createConv.mutate(
      { data: { participantId: userId } },
      { onSuccess: (conv) => setLocation(`/messages/${conv.id}`) }
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Messages</h1>
          <Button size="icon" variant="ghost" className="rounded-full text-primary bg-primary/10">
            <MessageSquarePlus className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search conversations or users..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {search.length > 2 && searchResults ? (
          <div className="p-2 space-y-1">
            <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">New Conversation</h3>
            {searchResults.map(user => (
              <button key={user.id} onClick={() => startConversation(user.id)} className="w-full text-left p-3 flex items-center gap-3 rounded-xl hover:bg-muted transition-colors">
                <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} className="w-10 h-10" />
                <div>
                  <div className="font-medium text-sm">{user.displayName}</div>
                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))
            ) : conversations?.length ? (
              conversations.map(conv => {
                const otherUser = conv.participants?.[0]; // Assuming 1-on-1 and API omits 'me'
                if (!otherUser) return null;
                
                return (
                  <Link key={conv.id} href={`/messages/${conv.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                      <UserAvatar name={otherUser.displayName} username={otherUser.username} avatarUrl={otherUser.avatarUrl} online={otherUser.isOnline} className="w-14 h-14 shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-semibold text-sm truncate pr-2">{otherUser.displayName}</h4>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                            {conv.lastMessage ? formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true, addPrefix: false }) : ''}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${conv.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                            {conv.lastMessage ? (
                              conv.lastMessage.senderId !== otherUser.id ? `You: ${conv.lastMessage.content}` : conv.lastMessage.content
                            ) : (
                              <span className="italic">No messages yet</span>
                            )}
                          </p>
                          {!!conv.unreadCount && (
                            <span className="shrink-0 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="text-center py-16 px-4">
                <MessageSquarePlus className="w-12 h-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-1">No Messages</h3>
                <p className="text-muted-foreground text-sm">Start a conversation with a friend on the lake.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
