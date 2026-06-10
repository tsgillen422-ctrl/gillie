import React from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetConversations,
  useGetConversationMessages,
  useGetMe,
  useGetUser,
  useMuteConversation,
  useDeleteConversation,
  getGetConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/UserAvatar";
import { ClickableImage } from "@/components/ClickableImage";
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
import { ArrowLeft, BellOff, Images, Trash2, User as UserIcon, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CARD = "rounded-3xl border border-card-border bg-card shadow-soft";

function mediaSrc(objectPath: string) {
  if (/^(https?:|data:|blob:)/.test(objectPath)) return objectPath;
  return `/api/storage${objectPath}`;
}

export function MessageSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me } = useGetMe();
  const { data: conversations, isLoading: loadingConvos } = useGetConversations();
  const { data: messages } = useGetConversationMessages(convId, { query: { enabled: !!convId } });

  const conversation = conversations?.find((c) => c.id === convId);
  const otherParticipants = (conversation?.participants ?? []).filter((p) => p.id !== me?.id);
  const isGroup = conversation?.isGroup ?? (otherParticipants.length > 1);
  const otherUserId = !isGroup ? otherParticipants[0]?.id : undefined;

  const { data: otherUser } = useGetUser(otherUserId ?? 0, { query: { enabled: !!otherUserId } });

  const title = conversation?.name
    ? conversation.name
    : isGroup
      ? otherParticipants.map((p) => p.displayName).join(", ") || "Group chat"
      : otherUser?.displayName || otherParticipants[0]?.displayName || "Conversation";

  const [muted, setMuted] = React.useState(false);
  React.useEffect(() => {
    if (conversation) setMuted(Boolean(conversation.muted));
  }, [conversation?.muted]);

  const muteConversation = useMuteConversation();
  const deleteConversation = useDeleteConversation();

  const sharedPhotos = (messages ?? [])
    .filter((m) => m.mediaUrl && m.mediaType === "image")
    .map((m) => mediaSrc(m.mediaUrl as string));

  const handleMuteToggle = (next: boolean) => {
    setMuted(next);
    muteConversation.mutate(
      { conversationId: convId, data: { muted: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
          toast({ title: next ? "Notifications muted" : "Notifications on" });
        },
        onError: () => {
          setMuted(!next);
          toast({ title: "Couldn't update notifications", variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = () => {
    deleteConversation.mutate(
      { conversationId: convId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
          toast({ title: "Conversation deleted" });
          navigate("/messages");
        },
        onError: () => toast({ title: "Couldn't delete conversation", variant: "destructive" }),
      },
    );
  };

  if (!Number.isFinite(convId)) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">This conversation couldn't be found.</p>
        <Link href="/messages">
          <Button variant="outline" className="rounded-full">Back to messages</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative z-50">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 border-b border-border bg-card/95 backdrop-blur shadow-sm shrink-0">
        <Link href={`/messages/${convId}`}>
          <Button size="icon" variant="ghost" className="h-9 w-9 -ml-1 rounded-full" aria-label="Back to conversation">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="font-semibold text-sm">Message settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingConvos && !conversation ? (
          <Skeleton className="h-24 w-full rounded-3xl" />
        ) : (
          <>
            {/* Conversation identity */}
            <div className={`${CARD} p-4 flex items-center gap-3`}>
              {isGroup ? (
                <div className="w-12 h-12 rounded-full bg-primary/15 border border-border flex items-center justify-center text-primary font-semibold shrink-0">
                  {(conversation?.name?.[0] || "G").toUpperCase()}
                </div>
              ) : (
                <UserAvatar
                  name={otherUser?.displayName || otherParticipants[0]?.displayName || "User"}
                  username={otherUser?.username || otherParticipants[0]?.username || ""}
                  avatarUrl={otherUser?.avatarUrl ?? otherParticipants[0]?.avatarUrl}
                  className="w-12 h-12 shrink-0"
                />
              )}
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{title}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isGroup ? `${(conversation?.participants?.length ?? otherParticipants.length + 1)} members` : "Direct message"}
                </p>
              </div>
            </div>

            {/* View profile (1:1) */}
            {!isGroup && otherUserId && (
              <Link href={`/profile/${otherUserId}`} className={`${CARD} p-4 flex items-center gap-3 hover-elevate active-elevate-2`}>
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
                  <UserIcon className="w-4 h-4" />
                </span>
                <span className="text-sm font-medium flex-1">View profile</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            )}

            {/* Mute notifications */}
            <div className={`${CARD} p-4 flex items-center gap-3`}>
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
                <BellOff className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Mute notifications</p>
                <p className="text-[11px] text-muted-foreground">You won't get alerts for new messages</p>
              </div>
              <Switch checked={muted} onCheckedChange={handleMuteToggle} disabled={muteConversation.isPending} aria-label="Mute notifications" />
            </div>

            {/* Shared Memories */}
            {sharedPhotos.length > 0 && (
              <div className={`${CARD} p-4`}>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <span className="grid place-items-center w-6 h-6 rounded-lg bg-primary/10 text-primary">
                    <Images className="w-3.5 h-3.5" />
                  </span>
                  Shared Memories
                </h3>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                  {sharedPhotos.map((src, i) => (
                    <ClickableImage
                      key={i}
                      src={src}
                      alt="Shared memory"
                      className="h-24 w-24 shrink-0 rounded-2xl object-cover border border-card-border snap-start"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Delete conversation */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className={`${CARD} p-4 flex items-center gap-3 w-full text-left hover-elevate active-elevate-2`}>
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-destructive/10 text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-medium text-destructive flex-1">Delete conversation</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes all messages in this conversation. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
