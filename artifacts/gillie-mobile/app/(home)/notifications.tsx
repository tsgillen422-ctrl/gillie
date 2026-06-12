import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { useGetNotifications, useMarkNotificationRead, useDeleteNotification, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { timeAgo } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch, isRefetching } = useGetNotifications();
  const markRead = useMarkNotificationRead();
  const deleteNotif = useDeleteNotification();

  const getTarget = (notif: { type: string; relatedId?: number | null }): string | null => {
    switch (notif.type) {
      case 'friend_request': return '/friends';
      case 'message': return notif.relatedId != null ? `/conversation/${notif.relatedId}` : '/messages';
      case 'post_like':
      case 'event':
      case 'rsvp': return notif.relatedId != null ? `/post/${notif.relatedId}` : '/feed';
      case 'pin_like': return notif.relatedId != null ? `/pin/${notif.relatedId}` : '/feed';
      case 'system': return '/settings';
      case 'sos':
      case 'warning': return '/conditions';
      default: return null;
    }
  };

  const handleOpen = (notif: any) => {
    if (!notif.read) {
      markRead.mutate({ notificationId: notif.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() })
      });
    }
    const target = getTarget(notif);
    if (target) {
      router.push(target as any);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Alert", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
          deleteNotif.mutate({ notificationId: id }, {
            onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() })
          });
      }}
    ]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'friend_request': return { name: "person-add", color: "#3b82f6" };
      case 'message': return { name: "chatbubble-ellipses", color: "#10b981" };
      case 'post_like':
      case 'pin_like': return { name: "heart", color: "#ef4444" };
      case 'event': return { name: "calendar", color: "#f59e0b" };
      default: return { name: "notifications", color: colors.primary };
    }
  };

  if (isLoading && !notifications) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Alerts</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You're all caught up!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>No new alerts.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = getIcon(item.type);
          return (
            <Pressable 
              style={[
                styles.card, 
                { 
                  backgroundColor: item.read ? colors.card : colors.primary + '15',
                  borderColor: colors.border 
                }
              ]}
              onPress={() => handleOpen(item)}
            >
              <View style={[styles.iconWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name={icon.name as any} size={20} color={icon.color} />
              </View>
              
              <View style={styles.info}>
                <Text 
                  style={[
                    styles.content, 
                    { 
                      color: item.read ? colors.mutedForeground : colors.foreground,
                      fontFamily: item.read ? fonts.sans : fonts.sansSemibold
                    }
                  ]}
                >
                  {item.message}
                </Text>
                <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                  {timeAgo(item.createdAt)}
                </Text>
              </View>

              {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              
              <Pressable onPress={() => handleDelete(item.id)} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 4 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14 },
  card: { 
    padding: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderRadius: 16, 
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: { flex: 1, marginRight: 8 },
  content: { fontSize: 15, marginBottom: 4, lineHeight: 20 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
});
