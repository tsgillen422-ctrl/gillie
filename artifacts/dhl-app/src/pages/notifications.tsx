import React from "react";
import { useGetNotifications, useMarkNotificationRead, useDeleteNotification, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, UserPlus, MessageSquare, Heart, Calendar, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

export function NotificationsPage() {
  const { data: notifications, isLoading } = useGetNotifications();
  const markRead = useMarkNotificationRead();
  const deleteNotif = useDeleteNotification();
  const queryClient = useQueryClient();

  const handleDelete = (notificationId: number) => {
    deleteNotif.mutate(
      { notificationId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
          toast.success("Alert deleted.");
        },
        onError: () => toast.error("Couldn't delete that alert."),
      }
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'friend_request': return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'message': return <MessageSquare className="w-5 h-5 text-emerald-500" />;
      case 'post_like':
      case 'pin_like': return <Heart className="w-5 h-5 text-destructive" />;
      case 'event': return <Calendar className="w-5 h-5 text-accent" />;
      default: return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Alerts</h1>
        {notifications?.some(n => !n.read) && (
          <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full">
            New
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : notifications?.length ? (
          <div className="divide-y divide-border/50">
            {notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-4 flex gap-4 items-center transition-colors ${!notif.read ? 'bg-primary/5' : 'bg-card'}`}
                onClick={() => {
                  if (!notif.read) markRead.mutate({ notificationId: notif.id });
                }}
              >
                <div className="shrink-0 p-2 bg-background rounded-full shadow-sm border border-border/50">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete alert"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this alert. This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(notif.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 px-4">
            <Bell className="w-16 h-16 text-muted/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">You're all caught up!</h3>
            <p className="text-muted-foreground text-sm">No new notifications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
