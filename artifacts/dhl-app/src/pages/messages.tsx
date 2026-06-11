import React from "react";
import { useGetConversations, useSearchUsers, useCreateConversation, useCreateGroupConversation, useGetMe, useDeleteConversation, getGetConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";
import { Search, MessageSquarePlus, Users, X, Check, Trash2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

export function MessagesPage() {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "unread" | "groups">("all");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const { data: conversations, isLoading } = useGetConversations();
  const { data: me } = useGetMe();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const queryClient = useQueryClient();
  const createConv = useCreateConversation();
  const createGroup = useCreateGroupConversation();
  const deleteConv = useDeleteConversation();

  const handleDeleteConversation = (conversationId: number) => {
    deleteConv.mutate(
      { conversationId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
          toast.success("Conversation deleted.");
        },
        onError: () => toast.error("Couldn't delete that conversation."),
      }
    );
  };
  const { data: searchResults } = useSearchUsers({ q: search }, { query: { enabled: search.length > 2 } });
  const autoStartRef = React.useRef<string | null>(null);

  const [groupOpen, setGroupOpen] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [groupSearch, setGroupSearch] = React.useState("");
  const [groupMembers, setGroupMembers] = React.useState<Array<{ id: number; displayName: string; username: string; avatarUrl?: string | null }>>([]);
  const { data: groupSearchResults } = useSearchUsers({ q: groupSearch }, { query: { enabled: groupSearch.length > 2 } });

  const startConversation = (userId: number) => {
    createConv.mutate(
      { data: { participantId: userId } },
      { onSuccess: (conv) => setLocation(`/messages/${conv.id}`) }
    );
  };

  // When arriving via /messages?user=ID (e.g. from a profile's "Message" button),
  // open (or create) the 1:1 conversation with that user automatically.
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const userIdStr = params.get("user");
    if (!userIdStr) return;
    const userId = Number(userIdStr);
    if (!Number.isFinite(userId)) return;
    if (autoStartRef.current === userIdStr) return;
    autoStartRef.current = userIdStr;
    createConv.mutate(
      { data: { participantId: userId } },
      {
        onSuccess: (conv) => setLocation(`/messages/${conv.id}`),
        onError: () => {
          // Allow a retry if opening the conversation failed.
          autoStartRef.current = null;
          toast.error("Couldn't open that conversation.");
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const toggleMember = (user: { id: number; displayName: string; username: string; avatarUrl?: string | null }) => {
    setGroupMembers((prev) =>
      prev.some((m) => m.id === user.id) ? prev.filter((m) => m.id !== user.id) : [...prev, user]
    );
  };

  const submitGroup = () => {
    if (!groupName.trim()) {
      toast.error("Give your group a name.");
      return;
    }
    if (groupMembers.length < 2) {
      toast.error("Add at least 2 people to a group.");
      return;
    }
    createGroup.mutate(
      { data: { name: groupName.trim(), participantIds: groupMembers.map((m) => m.id) } },
      {
        onSuccess: (conv) => {
          setGroupOpen(false);
          setGroupName("");
          setGroupSearch("");
          setGroupMembers([]);
          setLocation(`/messages/${conv.id}`);
        },
        onError: () => toast.error("Couldn't create the group."),
      }
    );
  };

  const isGroupConv = (conv: NonNullable<typeof conversations>[number]) =>
    conv.isGroup ?? ((conv.participants ?? []).filter((p) => p.id !== me?.id).length > 1);
  const filteredConversations = (conversations ?? []).filter((conv) => {
    if (filter === "unread") return !!conv.unreadCount;
    if (filter === "groups") return isGroupConv(conv);
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 pt-4 pb-3 border-b border-border bg-card shadow-sm sticky top-0 z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">Messages</h1>
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => searchInputRef.current?.focus()} aria-label="Search messages">
              <Search className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setGroupOpen(true)} aria-label="New group chat">
              <MessageSquarePlus className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="rounded-full" asChild aria-label="Friends">
              <Link href="/friends"><Users className="w-5 h-5" /></Link>
            </Button>
            <Link href="/profile/me" aria-label="Your profile" className="ml-1">
              <UserAvatar name={me?.displayName ?? "You"} username={me?.username ?? "you"} avatarUrl={me?.avatarUrl} className="w-9 h-9" />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {([["all", "All"], ["unread", "Unread"], ["groups", "Groups"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            ref={searchInputRef}
            placeholder="Search conversations or users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-muted border-none rounded-full"
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
            ) : filteredConversations.length ? (
              filteredConversations.map(conv => {
                const others = (conv.participants ?? []).filter((p) => p.id !== me?.id);
                const isGroup = conv.isGroup ?? (others.length > 1);
                const title = conv.name || (isGroup ? others.map((p) => p.displayName).join(", ") || "Group chat" : others[0]?.displayName);
                if (!isGroup && !others[0]) return null;

                return (
                  <div key={conv.id} className="flex items-center rounded-xl hover:bg-muted/50 transition-colors group">
                    <Link href={`/messages/${conv.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 p-3 cursor-pointer">
                        {isGroup ? (
                          <div className="w-14 h-14 rounded-full bg-primary/15 border border-border flex items-center justify-center text-primary shrink-0">
                            <Users className="w-6 h-6" />
                          </div>
                        ) : (
                          <UserAvatar name={others[0].displayName} username={others[0].username} avatarUrl={others[0].avatarUrl} online={others[0].isOnline} className="w-14 h-14 shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className="font-semibold text-sm truncate pr-2">{title}</h4>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                              {conv.lastMessage ? formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true }) : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm truncate ${conv.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                              {conv.lastMessage ? (() => {
                                const mine = conv.lastMessage.senderId === me?.id;
                                const senderFirst = mine
                                  ? "You"
                                  : (conv.participants ?? []).find((p) => p.id === conv.lastMessage!.senderId)?.displayName?.split(" ")[0];
                                return (mine || isGroup) && senderFirst ? (
                                  <><span className="font-medium text-foreground/70">{senderFirst}:</span> {conv.lastMessage.content}</>
                                ) : (
                                  conv.lastMessage.content
                                );
                              })() : (
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

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete conversation"
                          className="mr-1.5 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the conversation and all its messages for everyone. This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteConversation(conv.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })
            ) : conversations?.length ? (
              <div className="text-center py-16 px-6 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  {filter === "groups" ? (
                    <Users className="w-7 h-7 text-muted-foreground" />
                  ) : (
                    <Check className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-base font-semibold mb-1">
                  {filter === "unread" ? "You're all caught up" : filter === "groups" ? "No group chats yet" : "Nothing here"}
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {filter === "unread"
                    ? "No unread conversations right now."
                    : filter === "groups"
                      ? "Start a group chat to plan your next day on the lake."
                      : "No conversations match this filter."}
                </p>
              </div>
            ) : (
              <div className="text-center py-16 px-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquarePlus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No messages yet</h3>
                <p className="text-muted-foreground text-sm max-w-xs mb-5">
                  Find people on the lake and start a conversation, or spin up a group chat for the whole crew.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                  <Button asChild>
                    <Link href="/search">
                      <Search className="w-4 h-4 mr-2" /> Find people
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setGroupOpen(true)}>
                    <Users className="w-4 h-4 mr-2" /> New group chat
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={groupOpen} onOpenChange={(open) => { if (!open) { setGroupOpen(false); setGroupSearch(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>New group chat</DialogTitle>
            <DialogDescription>Name your group and add people from the lake.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groupMembers.map((m) => (
                  <span key={m.id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs rounded-full pl-2 pr-1 py-1">
                    {m.displayName}
                    <button onClick={() => toggleMember(m)} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search people to add..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-1">
              {groupSearch.length > 2 && groupSearchResults?.length ? (
                groupSearchResults
                  .filter((u) => u.id !== me?.id)
                  .map((user) => {
                    const selected = groupMembers.some((m) => m.id === user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleMember(user)}
                        className="w-full text-left p-2.5 flex items-center gap-3 rounded-xl hover:bg-muted transition-colors"
                      >
                        <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} className="w-9 h-9" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{user.displayName}</div>
                          <div className="text-xs text-muted-foreground truncate">@{user.username}</div>
                        </div>
                        {selected && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })
              ) : groupSearch.length > 2 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No people found.</p>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">Type at least 3 letters to search.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>Cancel</Button>
            <Button onClick={submitGroup} disabled={createGroup.isPending || !groupName.trim() || groupMembers.length < 2}>
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
