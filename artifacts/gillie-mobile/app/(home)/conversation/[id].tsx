import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useGetConversationMessages,
  useGetConversations,
  useSendMessage,
  useMarkConversationRead,
  useGetMe,
  getGetConversationMessagesQueryKey,
  getGetConversationsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "@/components/UserAvatar";
import { timeAgo } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: me } = useGetMe();
  const { data: conversations } = useGetConversations();
  const { data: messages, isLoading, refetch } = useGetConversationMessages(convId, {
    query: { enabled: Number.isFinite(convId), queryKey: getGetConversationMessagesQueryKey(convId) },
  });

  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const [content, setContent] = useState("");

  const conversation = conversations?.find((c) => c.id === convId);
  const participants = conversation?.participants ?? [];
  const isGroup = conversation?.isGroup ?? participants.length > 2;
  const counterpart = participants.filter((p) => p.id !== me?.id)[0] ?? participants[0];
  const headerTitle =
    conversation?.name || (isGroup ? "Group Chat" : counterpart?.displayName || "Chat");

  useEffect(() => {
    if (convId && Number.isFinite(convId)) {
      markRead.mutate(
        { conversationId: convId },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() }) }
      );
    }
  }, [convId, markRead, queryClient]);

  const handleSend = async () => {
    const text = content.trim();
    if (!text) return;
    setContent("");
    try {
      await sendMessage.mutateAsync({ conversationId: convId, data: { content: text } });
      refetch();
    } catch {
      setContent(text);
      Alert.alert("Message not sent", "Something went wrong. Please try again.");
    }
  };

  const displayData = [...(messages || [])].reverse();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 6, paddingBottom: 12 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          {isGroup ? (
            <View style={styles.groupAvatar}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
          ) : (
            <UserAvatar
              name={counterpart?.displayName}
              username={counterpart?.username}
              avatarUrl={counterpart?.avatarUrl}
              size={36}
              online={counterpart?.isOnline}
            />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
            {!isGroup && counterpart?.isOnline ? (
              <Text style={styles.headerStatus}>Active now</Text>
            ) : !isGroup && counterpart?.username ? (
              <Text style={styles.headerStatus}>@{counterpart.username}</Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {isLoading && !messages ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayData}
          inverted
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Say hello to start the conversation.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMine = item.senderId === me?.id;
            const showAvatar =
              !isMine &&
              (index === displayData.length - 1 || displayData[index + 1]?.senderId !== item.senderId);

            return (
              <View style={[styles.msgWrapper, isMine ? styles.msgRight : styles.msgLeft]}>
                {!isMine && (
                  <View style={styles.msgAvatar}>
                    {showAvatar && (
                      <UserAvatar
                        name={item.sender?.displayName}
                        username={item.sender?.username}
                        avatarUrl={item.sender?.avatarUrl}
                        size={28}
                      />
                    )}
                  </View>
                )}
                <View>
                  {!isMine && showAvatar && isGroup && (
                    <Text style={[styles.senderName, { color: colors.mutedForeground }]}>
                      {item.sender?.displayName}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.msgBubble,
                      isMine
                        ? [styles.bubbleMine, { backgroundColor: colors.primary }]
                        : [styles.bubbleTheirs, { backgroundColor: colors.muted }],
                    ]}
                  >
                    <Text
                      style={[styles.msgText, { color: isMine ? colors.primaryForeground : colors.foreground }]}
                    >
                      {item.content}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.msgTime,
                      { color: colors.mutedForeground, alignSelf: isMine ? "flex-end" : "flex-start" },
                    ]}
                  >
                    {timeAgo(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.inputRow,
          { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          value={content}
          onChangeText={setContent}
          multiline
        />
        <Pressable
          onPress={handleSend}
          style={[styles.sendBtn, { backgroundColor: content.trim() ? colors.primary : colors.muted }]}
          disabled={!content.trim() || sendMessage.isPending}
        >
          <Ionicons name="send" size={18} color={content.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  backBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center", marginRight: 2 },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: "#fff" },
  headerStatus: { fontFamily: fonts.sans, fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, textAlign: "center" },

  msgWrapper: { flexDirection: "row", marginBottom: 16, alignItems: "flex-end" },
  msgRight: { justifyContent: "flex-end" },
  msgLeft: { justifyContent: "flex-start" },
  msgAvatar: { width: 28, marginRight: 8 },
  senderName: { fontFamily: fonts.sansMedium, fontSize: 12, marginBottom: 2, marginLeft: 4 },
  msgBubble: { maxWidth: 270, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  msgText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 20 },
  msgTime: { fontFamily: fonts.sans, fontSize: 10, marginTop: 4, marginHorizontal: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  sendBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 20 },
});
