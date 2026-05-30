import React, { useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useGetConversationMessages, useSendMessage, useDeleteMessage, useGetConversations, useMarkConversationRead, getGetConversationMessagesQueryKey, getGetConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { ClickableImage } from "@/components/ClickableImage";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Send, ImagePlus, Loader2, X, Trash2, MoreVertical, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

function mediaSrc(objectPath: string) {
  return `/api/storage${objectPath}`;
}

export function MessageThreadPage() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id);
  const { data: messages, isLoading } = useGetConversationMessages(convId, { query: { enabled: !!convId, refetchInterval: 5000 } });
  const { data: me } = useGetMe();
  const { data: conversations } = useGetConversations();
  const conversation = conversations?.find((c) => c.id === convId);
  const otherParticipants = (conversation?.participants ?? []).filter((p) => p.id !== me?.id);
  const isGroup = conversation?.isGroup ?? (otherParticipants.length > 1);
  const headerTitle = conversation?.name
    ? conversation.name
    : isGroup
      ? otherParticipants.map((p) => p.displayName).join(", ") || "Group chat"
      : otherParticipants[0]?.displayName || "Conversation";
  const headerSubtitle = isGroup
    ? `${(conversation?.participants?.length ?? otherParticipants.length + 1)} members`
    : otherParticipants[0]?.isOnline
      ? "Online now"
      : "On the lake";
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const markRead = useMarkConversationRead();
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState<{ objectPath: string; type: "image" | "video" } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { uploadFile, isUploading } = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that file.", variant: "destructive" }),
  });

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(convId) });

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
      // Swallow connection errors — polling keeps the thread up to date.
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
    const res = await uploadFile(file);
    if (res?.objectPath) {
      setPending({ objectPath: res.objectPath, type: isVideo ? "video" : "image" });
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pending) return;

    sendMessage.mutate({
      conversationId: convId,
      data: {
        content: text.trim(),
        ...(pending ? { mediaUrl: pending.objectPath, mediaType: pending.type } : {}),
      },
    }, {
      onSuccess: () => {
        setText("");
        setPending(null);
        refresh();
      },
    });
  };

  const handleDelete = (messageId: number) => {
    deleteMessage.mutate({ messageId }, {
      onSuccess: () => {
        refresh();
        toast({ title: "Message deleted" });
      },
      onError: () => toast({ title: "Error", description: "Could not delete message.", variant: "destructive" }),
    });
  };

  return (
    <div className="flex flex-col h-full bg-background relative z-50">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shadow-sm shrink-0">
        <Link href="/messages">
          <Button size="icon" variant="ghost" className="h-8 w-8 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-border flex items-center justify-center text-primary font-semibold text-sm shrink-0">
              {(conversation?.name?.[0] || "G").toUpperCase()}
            </div>
          ) : (
            <UserAvatar
              name={otherParticipants[0]?.displayName || "User"}
              username={otherParticipants[0]?.username || ""}
              avatarUrl={otherParticipants[0]?.avatarUrl}
              online={otherParticipants[0]?.isOnline}
              className="w-10 h-10 shrink-0"
            />
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">{headerTitle}</h2>
            <p className="text-[11px] text-muted-foreground truncate">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse" ref={scrollRef}>
        <div className="space-y-4">
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
          ) : messages?.length ? (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === me?.id;
              const hasText = !!msg.content?.trim();
              const senderName = msg.sender?.displayName || otherParticipants.find((p) => p.id === msg.senderId)?.displayName;
              const showSenderName = isGroup && !isMe && senderName && messages[idx - 1]?.senderId !== msg.senderId;
              const isLastMine = isMe && idx === messages.length - 1;
              return (
                <div key={msg.id} className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showSenderName && (
                    <span className="text-[11px] font-medium text-muted-foreground mb-0.5 mx-1">{senderName}</span>
                  )}
                  <div className="flex items-center gap-1">
                    {isMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(msg.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <div className={`overflow-hidden ${msg.mediaUrl && !hasText ? '' : 'px-4 py-2.5'} rounded-2xl max-w-[80%] ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted/80 text-foreground rounded-tl-sm border border-border/50'
                    }`}>
                      {msg.mediaUrl && msg.mediaType === "image" && (
                        <ClickableImage src={mediaSrc(msg.mediaUrl)} alt="Photo" className={`max-w-full max-h-72 object-cover ${hasText ? 'rounded-xl mb-2 mt-1' : ''}`} />
                      )}
                      {msg.mediaUrl && msg.mediaType === "video" && (
                        <video src={mediaSrc(msg.mediaUrl)} controls className={`max-w-full max-h-72 ${hasText ? 'rounded-xl mb-2 mt-1' : ''}`} />
                      )}
                      {hasText && <p className={`text-sm ${msg.mediaUrl ? 'px-3 pb-1' : ''}`}>{msg.content}</p>}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 mx-1 flex items-center gap-1">
                    {format(new Date(msg.createdAt), 'h:mm a')}
                    {isLastMine && (
                      msg.read ? (
                        <span className="flex items-center gap-0.5 text-primary"><CheckCheck className="w-3 h-3" /> Read</span>
                      ) : (
                        <span className="flex items-center gap-0.5"><Check className="w-3 h-3" /> Sent</span>
                      )
                    )}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center text-muted-foreground text-sm py-10">
              No messages yet. Send the first message!
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-card border-t border-border shrink-0 pb-safe">
        {pending && (
          <div className="mb-2 relative inline-block">
            {pending.type === "image" ? (
              <img src={mediaSrc(pending.objectPath)} alt="" className="h-20 w-20 object-cover rounded-lg border border-border" />
            ) : (
              <video src={mediaSrc(pending.objectPath)} className="h-20 w-20 object-cover rounded-lg border border-border" />
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
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isUploading || !!pending}
            onClick={() => fileRef.current?.click()}
            className="h-11 w-11 rounded-full shrink-0"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </Button>
          <div className="flex-1 relative">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message..."
              className="pr-10 bg-muted/50 border-transparent rounded-full h-11 focus-visible:ring-1"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={(!text.trim() && !pending) || sendMessage.isPending}
            className="h-11 w-11 rounded-full shrink-0 shadow-sm"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
