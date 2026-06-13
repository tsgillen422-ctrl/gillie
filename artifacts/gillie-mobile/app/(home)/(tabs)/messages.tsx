import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
  ScrollView,
} from "react-native";
import { useGetConversations, useGetMe } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import UserAvatar from "@/components/UserAvatar";
import { timeAgo } from "@/lib/format";
import { Ionicons } from "@expo/vector-icons";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: convos, isLoading, refetch, isRefetching } = useGetConversations();
  const { data: me } = useGetMe();

  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");

  const isGroupConv = (item: any) =>
    item.isGroup ?? (item.participants ?? []).filter((p: any) => p.id !== me?.id).length > 1;

  const convoTitle = (item: any) => {
    const others = (item.participants ?? []).filter((p: any) => p.id !== me?.id);
    const group = isGroupConv(item);
    return (
      item.name ||
      (group ? others.map((p: any) => p.displayName).join(", ") || "Group Chat" : others[0]?.displayName || "Conversation")
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (convos ?? []).filter((item: any) => {
      if (filter === "unread" && !item.unreadCount) return false;
      if (filter === "groups" && !isGroupConv(item)) return false;
      if (q) {
        const title = convoTitle(item).toLowerCase();
        const preview = (item.lastMessage?.content ?? "").toLowerCase();
        if (!title.includes(q) && !preview.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convos, filter, search, me?.id]);

  const Header = (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 10 },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Messages</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/friends")} style={styles.headerIcon}>
            <Ionicons name="people-outline" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/friends")}
            style={styles.headerIcon}
            accessibilityLabel="Start a new conversation"
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
        <Ionicons name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {Header}

      {isLoading && !convos ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 8, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {filter === "unread"
                  ? "You're all caught up"
                  : filter === "groups"
                    ? "No group chats yet"
                    : search
                      ? "No matches"
                      : "No messages yet"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {filter === "all" && !search
                  ? "Start a conversation with someone from your crew."
                  : "Nothing here right now."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isGroup = isGroupConv(item);
            const others = (item.participants ?? []).filter((p: any) => p.id !== me?.id);
            const other = others[0] ?? (item.participants ?? [])[0];
            const title = convoTitle(item);
            const unread = !!item.unreadCount;

            let preview = "No messages yet";
            if (item.lastMessage) {
              const mine = item.lastMessage.senderId === me?.id;
              const body = item.lastMessage.content || "Sent an attachment";
              preview = mine ? `You: ${body}` : body;
            }

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  unread ? { backgroundColor: colors.primary + "0D" } : null,
                  pressed ? { backgroundColor: colors.muted } : null,
                ]}
                onPress={() => router.push(`/conversation/${item.id}`)}
              >
                {isGroup ? (
                  <View style={[styles.groupAvatar, { backgroundColor: colors.primary + "26", borderColor: colors.border }]}>
                    <Ionicons name="people" size={26} color={colors.primary} />
                  </View>
                ) : (
                  <UserAvatar
                    name={other?.displayName}
                    username={other?.username}
                    avatarUrl={other?.avatarUrl}
                    size={56}
                    online={other?.isOnline}
                  />
                )}

                <View style={styles.infoContainer}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                      {title}
                    </Text>
                    {item.lastMessage && (
                      <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                        {timeAgo(item.lastMessage.createdAt)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.messageRow}>
                    <Text
                      style={[
                        styles.lastMessage,
                        {
                          color: unread ? colors.foreground : colors.mutedForeground,
                          fontFamily: unread ? fonts.sansSemibold : fonts.sans,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                    {unread && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>
                          {item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { fontFamily: fonts.displayBold, fontSize: 28, letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerIcon: { padding: 6, borderRadius: 999 },
  pillRow: { gap: 8, paddingRight: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  pillText: { fontFamily: fonts.sansSemibold, fontSize: 13 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, padding: 0 },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 70, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: "center" },

  row: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14 },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoContainer: { flex: 1, marginLeft: 14 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  title: { fontFamily: fonts.sansBold, fontSize: 15.5, flex: 1, paddingRight: 8 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 11 },
  messageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lastMessage: { fontSize: 14, flex: 1, paddingRight: 8, lineHeight: 19 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { fontFamily: fonts.sansBold, fontSize: 11 },
});
