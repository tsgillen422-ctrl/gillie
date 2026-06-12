import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useGetNotifications,
  useMarkNotificationRead,
  useDeleteNotification,
  getGetNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { timeAgo } from "@/lib/format";
import SoftCard from "@/components/ui/SoftCard";
import { useQueryClient } from "@tanstack/react-query";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

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
      case "friend_request":
        return "/friends";
      case "message":
        return notif.relatedId != null ? `/conversation/${notif.relatedId}` : "/messages";
      case "post_like":
      case "event":
      case "rsvp":
        return notif.relatedId != null ? `/post/${notif.relatedId}` : "/feed";
      case "pin_like":
        return notif.relatedId != null ? `/pin/${notif.relatedId}` : "/feed";
      case "system":
        return "/settings";
      case "sos":
      case "warning":
        return "/conditions";
      default:
        return null;
    }
  };

  const handleOpen = (notif: any) => {
    if (!notif.read) {
      markRead.mutate(
        { notificationId: notif.id },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }) }
      );
    }
    const target = getTarget(notif);
    if (target) {
      router.push(target as any);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Alert", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteNotif.mutate(
            { notificationId: id },
            { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }) }
          );
        },
      },
    ]);
  };

  const getIcon = (type: string): { name: IoniconName; color: string } => {
    switch (type) {
      case "friend_request":
        return { name: "person-add", color: "#3b82f6" };
      case "message":
        return { name: "chatbubble-ellipses", color: "#10b981" };
      case "post_like":
      case "pin_like":
        return { name: "heart", color: "#ef4444" };
      case "event":
      case "rsvp":
        return { name: "calendar", color: "#f59e0b" };
      case "sos":
      case "warning":
        return { name: "warning", color: colors.destructive };
      default:
        return { name: "notifications", color: colors.primary };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 6, paddingBottom: 14 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Alerts</Text>
            <Text style={styles.headerSubtitle}>What's happening on the lake</Text>
          </View>
        </View>
      </LinearGradient>

      {isLoading && !notifications ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={56} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You're all caught up!</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>No new alerts.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const icon = getIcon(item.type);
            return (
              <SoftCard
                style={[
                  styles.card,
                  !item.read ? { borderColor: colors.primary, backgroundColor: colors.primary + "0D" } : null,
                ]}
                padded={false}
              >
                <Pressable style={styles.row} onPress={() => handleOpen(item)}>
                  <View style={[styles.iconWrapper, { backgroundColor: icon.color + "1A" }]}>
                    <Ionicons name={icon.name} size={20} color={icon.color} />
                  </View>

                  <View style={styles.info}>
                    <Text
                      style={[
                        styles.content,
                        {
                          color: item.read ? colors.mutedForeground : colors.foreground,
                          fontFamily: item.read ? fonts.sans : fonts.sansSemibold,
                        },
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
                    <Ionicons name="trash-outline" size={19} color={colors.mutedForeground} />
                  </Pressable>
                </Pressable>
              </SoftCard>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  backBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center", marginRight: 2 },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 24, color: "#fff" },
  headerSubtitle: { fontFamily: fonts.sans, fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 1 },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 70, gap: 10 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14 },

  card: { marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  iconWrapper: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginRight: 12 },
  info: { flex: 1, marginRight: 8 },
  content: { fontSize: 14.5, marginBottom: 4, lineHeight: 20 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
});
