import React, { useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  useGetConversationMessages,
  useSendMessage,
  useDeleteMessage,
  useGetConversations,
  useMarkConversationRead,
  useReactToMessage,
  useGetMutualFriends,
  useGetUser,
  useGetMe,
  getGetConversationMessagesQueryKey,
  getGetConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { ClickableImage } from "@/components/ClickableImage";
import { MatureGate } from "@/components/MatureGate";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeRow } from "@/components/Badges";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Send,
  ImagePlus,
  Loader2,
  X,
  Trash2,
  MoreVertical,
  Check,
  CheckCheck,
  SmilePlus,
  MapPin,
  Users,
  Fish,
  Anchor,
  Sunset,
  Navigation,
  CalendarHeart,
  Image as ImageIcon,
  Video as VideoIcon,
  Film as GifIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress";
import { GifPickerDialog } from "@/components/GifPickerDialog";

const CARD = "rounded-3xl border border-card-border bg-card shadow-soft";

const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "fish", emoji: "🎣" },
  { key: "boat", emoji: "🚤" },
  { key: "fire", emoji: "🔥" },
] as const;
const REACTION_EMOJI: Record<string, string> = {
  heart: "❤️",
  fish: "🎣",
  boat: "🚤",
  fire: "🔥",
};

const COMPAT = [
  { key: "fishing", label: "Fishing", Icon: Fish },
  { key: "boating", label: "Boating", Icon: Anchor },
  { key: "sunsets", label: "Sunset Spots", Icon: Sunset },
];

const STARTERS = [
  "How's the fishing today? 🎣",
  "Anyone at Sunset Marina? 🌅",
  "Want to meet up this weekend? 🚤",
];

function mediaSrc(objectPath: string) {
  if (/^(https?:|data:|blob:)/.test(objectPath)) return objectPath;
  return `/api/storage${objectPath}`;
}

type ReactionCounts = Record<string, number>;

function applyReactionToggle(msg: any, reaction: string) {
  const counts: ReactionCounts = { heart: 0, fish: 0, boat: 0, fire: 0, ...(msg.reactions || {}) };
  const prev = msg.myReaction;
  if (prev === reaction) {
    counts[reaction] = Math.max((counts[reaction] || 0) - 1, 0);
    return { ...msg, reactions: counts, myReaction: null };
  }
  if (prev) counts[prev] = Math.max((counts[prev] || 0) - 1, 0);
  counts[reaction] = (counts[reaction] || 0) + 1;
  return { ...msg, reactions: counts, myReaction: reaction };
}

function activityLine(u: any): string {
  if (!u) return "On the lake";
  if (u.isOnline) return "Active now";
  if (u.location) return `On the lake · ${u.location}`;
  return "On the lake";
}

function LakeCompatibility({ me, other }: { me: any; other: any }) {
  const mine = new Set<string>(me?.interests ?? []);
  const theirs = new Set<string>(other?.interests ?? []);
  const matched = COMPAT.filter((c) => mine.has(c.key) && theirs.has(c.key)).length;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <span className="grid place-items-center w-6 h-6 rounded-lg bg-primary/10 text-primary">
            <Anchor className="w-3.5 h-3.5" />
          </span>
          Lake Compatibility
        </h3>
        <span className="text-[11px] font-semibold text-primary">{matched}/{COMPAT.length} shared</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {COMPAT.map(({ key, label, Icon }) => {
          const shared = mine.has(key) && theirs.has(key);
          return (
            <div
              key={key}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition-colors ${
                shared
                  ? "bg-primary/10 border border-primary/30 text-primary"
                  : "bg-muted/40 border border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium leading-tight">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileHero({
  other,
  fallbackName,
  mutualCount,
}: {
  other: any;
  fallbackName: string;
  mutualCount: number | null;
}) {
  const name = other?.displayName || fallbackName;
  const online = !!other?.isOnline;
  return (
    <div className={`${CARD} p-5 flex flex-col items-center text-center`}>
      <div className="relative">
        <UserAvatar
          name={name}
          username={other?.username || ""}
          avatarUrl={other?.avatarUrl}
          className="w-20 h-20 ring-4 ring-white dark:ring-card shadow-soft-lg"
        />
        {online && (
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-card" />
        )}
      </div>
      <h2 className="mt-3 text-lg font-bold leading-tight">{name}</h2>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        <span>{activityLine(other)}</span>
      </div>

      {other?.rank?.title && (
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
          {other.rank.title}
        </span>
      )}

      {mutualCount != null && mutualCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>
            {mutualCount} mutual {mutualCount === 1 ? "friend" : "friends"} on the lake
          </span>
        </div>
      )}

      {!!other?.badges?.some((b: any) => b.earned) && (
        <div className="mt-3">
          <BadgeRow badges={other.badges} limit={4} />
        </div>
      )}

      {other?.id && (
        <Link href={`/profile/${other.id}`}>
          <Button variant="outline" size="sm" className="mt-4 rounded-full">
            View Profile
          </Button>
        </Link>
      )}
    </div>
  );
}

function WelcomeCard({
  other,
  fallbackName,
  mutualCount,
  onStarter,
  onFirstMessage,
}: {
  other: any;
  fallbackName: string;
  mutualCount: number | null;
  onStarter: (text: string) => void;
  onFirstMessage: () => void;
}) {
  const name = other?.displayName || fallbackName;
  const online = !!other?.isOnline;
  return (
    <div className="flex flex-col items-center justify-center py-6 px-1">
      <div className={`${CARD} w-full max-w-sm p-6 flex flex-col items-center text-center`}>
        {other?.id ? (
          <Link href={`/profile/${other.id}`} className="relative rounded-full hover-elevate active-elevate-2" aria-label={`View ${name}'s profile`}>
            <UserAvatar
              name={name}
              username={other?.username || ""}
              avatarUrl={other?.avatarUrl}
              className="w-24 h-24 ring-4 ring-white dark:ring-card shadow-soft-lg"
            />
            {online && (
              <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-card" />
            )}
          </Link>
        ) : (
          <div className="relative">
            <UserAvatar
              name={name}
              username={other?.username || ""}
              avatarUrl={other?.avatarUrl}
              className="w-24 h-24 ring-4 ring-white dark:ring-card shadow-soft-lg"
            />
            {online && (
              <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-card" />
            )}
          </div>
        )}
        {other?.id ? (
          <Link href={`/profile/${other.id}`} className="mt-4 text-xl font-bold leading-tight hover:underline">{name}</Link>
        ) : (
          <h2 className="mt-4 text-xl font-bold leading-tight">{name}</h2>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          {online && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          <span>{online ? "Active now" : "On the lake"}</span>
        </div>
        {other?.location && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>{other.location}</span>
          </div>
        )}
        {mutualCount != null && mutualCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>
              {mutualCount} mutual {mutualCount === 1 ? "friend" : "friends"}
            </span>
          </div>
        )}

        <Button onClick={onFirstMessage} className="mt-5 rounded-full px-6 shadow-soft">
          <Send className="w-4 h-4 mr-2" /> Send First Message
        </Button>
      </div>

      <div className="w-full max-w-sm mt-5">
        <p className="text-xs font-medium text-muted-foreground text-center mb-2.5">
          Break the ice
        </p>
        <div className="flex flex-col gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => onStarter(s)}
              className="w-full text-left text-sm rounded-2xl border border-card-border bg-card px-4 py-3 shadow-soft hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReactionPicker({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="opacity-50 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 shrink-0"
          aria-label="React to message"
        >
          <SmilePlus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5 rounded-full" align="center" sideOffset={6}>
        <div className="flex items-center gap-0.5">
          {REACTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                onPick(r.key);
                setOpen(false);
              }}
              className="text-xl leading-none p-1.5 rounded-full hover:bg-muted active:scale-90 transition-transform"
              aria-label={r.key}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MessageThreadPage() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id);
  const { data: messages, isLoading } = useGetConversationMessages(convId, {
    query: { enabled: !!convId, refetchInterval: 5000 },
  });
  const { data: me } = useGetMe();
  const { data: conversations } = useGetConversations();
  const conversation = conversations?.find((c) => c.id === convId);
  const otherParticipants = (conversation?.participants ?? []).filter((p) => p.id !== me?.id);
  const isGroup = conversation?.isGroup ?? (otherParticipants.length > 1);
  const otherUserId = !isGroup ? otherParticipants[0]?.id : undefined;

  const { data: otherUser } = useGetUser(otherUserId ?? 0, {
    query: { enabled: !!otherUserId },
  });
  const { data: mutual } = useGetMutualFriends(otherUserId ?? 0, {
    query: { enabled: !!otherUserId },
  });

  const headerTitle = conversation?.name
    ? conversation.name
    : isGroup
      ? otherParticipants.map((p) => p.displayName).join(", ") || "Group chat"
      : otherUser?.displayName || otherParticipants[0]?.displayName || "Conversation";
  const headerSubtitle = isGroup
    ? `${conversation?.participants?.length ?? otherParticipants.length + 1} members`
    : (otherUser?.isOnline ?? otherParticipants[0]?.isOnline)
      ? "Active now"
      : "On the lake";

  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const markRead = useMarkConversationRead();
  const reactMessage = useReactToMessage();
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState<{ objectPath: string; type: "image" | "video" } | null>(null);
  const [gifOpen, setGifOpen] = React.useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { uploadFile, isUploading } = useUpload({
    onError: () =>
      toast({ title: "Upload failed", description: "Could not upload that file.", variant: "destructive" }),
  });

  const messagesKey = getGetConversationMessagesQueryKey(convId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const hasUnreadFromOthers = !!messages?.some((m) => m.senderId !== me?.id && !m.read);
  useEffect(() => {
    if (!convId || !me || !hasUnreadFromOthers) return;
    markRead.mutate(
      { conversationId: convId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() }) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, me?.id, hasUnreadFromOthers]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: messagesKey });

  // Real-time updates via websocket. Falls back to the 5s polling above if the
  // socket can't connect (e.g. proxy doesn't support upgrades).
  useEffect(() => {
    if (!convId) return;
    let ws: WebSocket | null = null;
    try {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${window.location.host}/api/ws`);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "subscribe", conversationId: convId }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "message" && data.conversationId === convId) {
            queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(convId) });
            queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
          }
        } catch {
          // ignore malformed payloads
        }
      };
      ws.onerror = () => {};
    } catch {
      // WebSocket unavailable; rely on polling.
    }
    return () => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast({ title: "Unsupported file", description: "Only photos and videos can be sent.", variant: "destructive" });
      return;
    }
    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const res = await uploadFile(toUpload);
      if (res?.objectPath) {
        setPending({ objectPath: res.objectPath, type: isVideo ? "video" : "image" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Could not upload that file.", variant: "destructive" });
    }
  };

  const doSend = (content: string, media: typeof pending) => {
    if (!content.trim() && !media) return;
    sendMessage.mutate(
      {
        conversationId: convId,
        data: {
          content: content.trim(),
          ...(media ? { mediaUrl: media.objectPath, mediaType: media.type } : {}),
        },
      },
      {
        onSuccess: () => {
          setText("");
          setPending(null);
          refresh();
        },
      }
    );
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    doSend(text, pending);
  };

  const handleDelete = (messageId: number) => {
    deleteMessage.mutate(
      { messageId },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "Message deleted" });
        },
        onError: () => toast({ title: "Error", description: "Could not delete message.", variant: "destructive" }),
      }
    );
  };

  const handleReact = (messageId: number, reaction: string) => {
    queryClient.setQueryData(messagesKey, (old: any) =>
      Array.isArray(old) ? old.map((m: any) => (m.id === messageId ? applyReactionToggle(m, reaction) : m)) : old
    );
    reactMessage.mutate(
      { messageId, data: { reaction: reaction as any } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: messagesKey }),
        onError: () => queryClient.invalidateQueries({ queryKey: messagesKey }),
      }
    );
  };

  const handleQuickAction = (key: string) => {
    const prefill: Record<string, string> = {
      fishing: "🎣 Fishing report: ",
      meet: "Want to meet up this weekend? 🚤",
      location: "📍 I'm headed to ",
    };
    setText((t) => (t ? t : prefill[key] ?? ""));
    inputRef.current?.focus();
  };

  const mutualCount = mutual?.count ?? null;
  const hasMessages = !!messages?.length;

  return (
    <div className="flex flex-col h-full bg-background relative z-50">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 border-b border-border bg-card/95 backdrop-blur shadow-sm shrink-0">
        <Link href="/messages">
          <Button size="icon" variant="ghost" className="h-9 w-9 -ml-1 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        {isGroup ? (
          <Link
            href={`/messages/${convId}/settings`}
            className="flex items-center gap-3 min-w-0 rounded-full -ml-1 pl-1 pr-2 py-1 hover-elevate active-elevate-2"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-border flex items-center justify-center text-primary font-semibold text-sm shrink-0">
              {(conversation?.name?.[0] || "G").toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm truncate">{headerTitle}</h2>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                {headerSubtitle}
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href={`/messages/${convId}/settings`}
            className="flex items-center gap-3 min-w-0 rounded-full -ml-1 pl-1 pr-2 py-1 hover-elevate active-elevate-2"
          >
            <UserAvatar
              name={otherUser?.displayName || otherParticipants[0]?.displayName || "User"}
              username={otherUser?.username || otherParticipants[0]?.username || ""}
              avatarUrl={otherUser?.avatarUrl ?? otherParticipants[0]?.avatarUrl}
              online={otherUser?.isOnline ?? otherParticipants[0]?.isOnline}
              className="w-10 h-10 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-sm truncate">{headerTitle}</h2>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                {(otherUser?.isOnline ?? otherParticipants[0]?.isOnline) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
                {headerSubtitle}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
        {isLoading ? (
          <div className="space-y-4">
            {[
              { mine: false, w: "w-40" },
              { mine: true, w: "w-28" },
              { mine: false, w: "w-52" },
              { mine: true, w: "w-36" },
              { mine: false, w: "w-32" },
            ].map((b, i) => (
              <div key={i} className={`flex ${b.mine ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-10 ${b.w} rounded-2xl ${b.mine ? "rounded-tr-sm" : "rounded-tl-sm"}`} />
              </div>
            ))}
          </div>
        ) : !hasMessages && !isGroup ? (
          <WelcomeCard
            other={otherUser}
            fallbackName={headerTitle}
            mutualCount={mutualCount}
            onStarter={(t) => doSend(t, null)}
            onFirstMessage={() => inputRef.current?.focus()}
          />
        ) : (
          <div className="space-y-4">
            {/* Profile context (1:1 only) */}
            {!isGroup && (
              <div className="space-y-3 pb-1">
                <ProfileHero other={otherUser} fallbackName={headerTitle} mutualCount={mutualCount} />
                <LakeCompatibility me={me} other={otherUser} />
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">Messages</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

            {messages?.map((msg, idx) => {
              const isMe = msg.senderId === me?.id;
              const hasText = !!msg.content?.trim();
              const senderName =
                msg.sender?.displayName || otherParticipants.find((p) => p.id === msg.senderId)?.displayName;
              const showSenderName =
                isGroup && !isMe && senderName && messages[idx - 1]?.senderId !== msg.senderId;
              const isLastMine = isMe && idx === messages.length - 1;
              const reactionEntries = Object.entries((msg.reactions as ReactionCounts) || {}).filter(
                ([, n]) => (n as number) > 0
              );

              return (
                <div
                  key={msg.id}
                  className={`group flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {showSenderName && (
                    <span className="text-[11px] font-medium text-muted-foreground mb-0.5 mx-1">{senderName}</span>
                  )}
                  <div className={`flex items-center gap-1 ${isMe ? "flex-row" : "flex-row-reverse"}`}>
                    {isMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 shrink-0" aria-label="Message options">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(msg.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <ReactionPicker onPick={(r) => handleReact(msg.id, r)} />
                    <div
                      className={`overflow-hidden ${msg.mediaUrl && !hasText ? "" : "px-4 py-2.5"} rounded-3xl max-w-[78%] shadow-soft ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card text-foreground rounded-bl-md border border-card-border"
                      }`}
                    >
                      <MatureGate isMature={(msg as any).isMature} label="Sensitive message">
                      {msg.mediaUrl && msg.mediaType === "image" && (
                        <ClickableImage
                          src={mediaSrc(msg.mediaUrl)}
                          alt="Photo"
                          className={`max-w-full max-h-72 object-cover ${hasText ? "rounded-2xl mb-2 mt-1" : ""}`}
                        />
                      )}
                      {msg.mediaUrl && msg.mediaType === "video" && (
                        <video
                          src={mediaSrc(msg.mediaUrl)}
                          controls
                          className={`max-w-full max-h-72 ${hasText ? "rounded-2xl mb-2 mt-1" : ""}`}
                        />
                      )}
                      {hasText && <p className={`text-sm ${msg.mediaUrl ? "px-3 pb-1" : ""}`}>{msg.content}</p>}
                      </MatureGate>
                    </div>
                  </div>

                  {reactionEntries.length > 0 && (
                    <div className={`flex gap-1 mt-1 mx-1 flex-wrap ${isMe ? "justify-end" : "justify-start"}`}>
                      {reactionEntries.map(([key, n]) => (
                        <button
                          key={key}
                          onClick={() => handleReact(msg.id, key)}
                          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                            msg.myReaction === key
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-card border-card-border text-foreground"
                          }`}
                        >
                          <span className="leading-none">{REACTION_EMOJI[key] ?? "❤️"}</span>
                          {(n as number) > 1 && <span className="font-medium">{n as number}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-muted-foreground mt-1 mx-1 flex items-center gap-1">
                    {format(new Date(msg.createdAt), "h:mm a")}
                    {isLastMine &&
                      (msg.read ? (
                        <span className="flex items-center gap-0.5 text-primary">
                          <CheckCheck className="w-3 h-3" /> Read
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Sent
                        </span>
                      ))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-card border-t border-border shrink-0 pb-safe">
        {/* Quick action chips */}
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1 -mb-1">
          {[
            { key: "fishing", label: "Fishing Report", Icon: Fish },
            { key: "meet", label: "Meet Up", Icon: CalendarHeart },
            { key: "location", label: "Share Location", Icon: Navigation },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleQuickAction(key)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-card-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-3 pt-2">
          {pending && (
            <div className="mb-2 relative inline-block">
              {pending.type === "image" ? (
                <img
                  src={mediaSrc(pending.objectPath)}
                  alt=""
                  className="h-20 w-20 object-cover rounded-2xl border border-border"
                />
              ) : (
                <video
                  src={mediaSrc(pending.objectPath)}
                  className="h-20 w-20 object-cover rounded-2xl border border-border"
                />
              )}
              <button
                type="button"
                onClick={() => setPending(null)}
                className="absolute -top-2 -right-2 bg-foreground text-background rounded-full p-0.5 shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isUploading || !!pending}
                  className="h-11 w-11 rounded-full shrink-0"
                >
                  {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuItem onSelect={() => photoRef.current?.click()}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Photo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => videoRef.current?.click()}>
                  <VideoIcon className="mr-2 h-4 w-4" />
                  Video
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setGifOpen(true)}>
                  <GifIcon className="mr-2 h-4 w-4" />
                  GIF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <GifPickerDialog
              open={gifOpen}
              onOpenChange={setGifOpen}
              description="Search for a GIF to send."
              onSelect={(url) => {
                setPending({ objectPath: url, type: "image" });
                setGifOpen(false);
              }}
            />
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message..."
                className="pr-4 bg-muted/50 border-transparent rounded-full h-11 focus-visible:ring-1"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={(!text.trim() && !pending) || sendMessage.isPending}
              className="h-12 w-12 rounded-full shrink-0 shadow-lg shadow-primary/30 active:scale-90 transition-transform"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
