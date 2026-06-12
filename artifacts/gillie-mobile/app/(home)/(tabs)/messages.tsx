import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useGetConversations, useGetMe } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useRouter } from "expo-router";
import UserAvatar from "@/components/UserAvatar";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SoftCard from "@/components/ui/SoftCard";
import { timeAgo } from "@/lib/format";
import { Ionicons } from "@expo/vector-icons";

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: convos, isLoading, refetch, isRefetching } = useGetConversations();
  const { data: me } = useGetMe();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Messages"
        gradient
        subtitle="Your crew, one tap away"
        right={
          <Pressable onPress={() => router.push("/friends")} style={styles.headerIcon}>
            <Ionicons name="create-outline" size={24} color="#fff" />
          </Pressable>
        }
      />

      {isLoading && !convos ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Start a conversation with someone from your crew.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const allParticipants = item.participants ?? [];
            const isGroup = item.isGroup ?? allParticipants.length > 2;
            const others = allParticipants.filter((p) => p.id !== me?.id);
            const other = others[0] ?? allParticipants[0];
            const title = item.name || (isGroup ? "Group Chat" : other?.displayName || "Conversation");
            const unread = !!item.unreadCount;

            let preview = "No messages yet";
            if (item.lastMessage) {
              const mine = item.lastMessage.senderId === me?.id;
              const body = item.lastMessage.content || "Sent an attachment";
              preview = mine ? `You: ${body}` : body;
            }

            return (
              <SoftCard
                style={[
                  styles.card,
                  unread ? { borderColor: colors.primary, backgroundColor: colors.primary + "0D" } : null,
                ]}
                padded={false}
              >
                <Pressable style={styles.cardInner} onPress={() => router.push(`/conversation/${item.id}`)}>
                  {isGroup ? (
                    <View style={[styles.groupAvatar, { backgroundColor: colors.muted }]}>
                      <Ionicons name="people" size={26} color={colors.mutedForeground} />
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
                            color: unread ? colors.foreground : colors.mutedForeground,
                            fontFamily: unread ? fonts.sansSemibold : fonts.sans,
                          },
                        ]}
                        numberOfLines={2}
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
  headerIcon: { padding: 4 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 70, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: "center" },
  card: { marginBottom: 12 },
  cardInner: { flexDirection: "row", alignItems: "center", padding: 12 },
  groupAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  infoContainer: { flex: 1, marginLeft: 14 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontFamily: fonts.sansBold, fontSize: 16, flex: 1, paddingRight: 8 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 12 },
  messageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lastMessage: { fontSize: 14, flex: 1, paddingRight: 8, lineHeight: 19 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  unreadText: { fontFamily: fonts.sansBold, fontSize: 12 },
});
