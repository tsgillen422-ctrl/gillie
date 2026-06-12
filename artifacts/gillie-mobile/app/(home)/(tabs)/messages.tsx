import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useGetConversations, useGetMe } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import UserAvatar from "@/components/UserAvatar";
import { timeAgo } from "@/lib/format";
import { Ionicons } from "@expo/vector-icons";

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: convos, isLoading, refetch, isRefetching } = useGetConversations();
  const { data: me } = useGetMe();

  if (isLoading && !convos) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Messages</Text>
      </View>

      <FlatList
        data={convos}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Start a conversation with someone.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const allParticipants = item.participants ?? [];
          const isGroup = item.isGroup ?? (allParticipants.length > 2);
          const others = allParticipants.filter((p) => p.id !== me?.id);
          const other = others[0] ?? allParticipants[0];
          const title = item.name || (isGroup ? "Group Chat" : other?.displayName || "Conversation");

          return (
            <Pressable
              style={[styles.card, { backgroundColor: item.unreadCount ? colors.primary + '10' : colors.card, borderBottomColor: colors.border }]}
              onPress={() => router.push(`/conversation/${item.id}`)}
            >
              <View style={styles.avatarContainer}>
                {isGroup ? (
                  <View style={[styles.groupAvatar, { backgroundColor: colors.muted }]}>
                    <Ionicons name="people" size={24} color={colors.mutedForeground} />
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
              </View>

              <View style={styles.infoContainer}>
                <View style={styles.titleRow}>
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
                        color: item.unreadCount ? colors.foreground : colors.mutedForeground,
                        fontFamily: item.unreadCount ? fonts.sansBold : fonts.sans
                      }
                    ]} 
                    numberOfLines={2}
                  >
                    {item.lastMessage ? item.lastMessage.content || "Sent an attachment" : "No messages yet"}
                  </Text>
                  {!!item.unreadCount && (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 24 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 4 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  card: { 
    flexDirection: 'row', 
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center'
  },
  avatarContainer: { marginRight: 16 },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontFamily: fonts.sansBold, fontSize: 16, flex: 1, paddingRight: 8 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { fontSize: 14, flex: 1, paddingRight: 8 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontFamily: fonts.sansBold, fontSize: 12 },
});
