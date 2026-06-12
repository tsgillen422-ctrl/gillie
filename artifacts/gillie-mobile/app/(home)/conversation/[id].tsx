import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useGetConversationMessages, useSendMessage, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: messages, isLoading, refetch } = useGetConversationMessages(Number(id), { query: { enabled: Number.isFinite(Number(id)), queryKey: getGetConversationMessagesQueryKey(Number(id)) }});
  const sendMessage = useSendMessage();
  const [content, setContent] = useState("");

  const handleSend = async () => {
    if (!content) return;
    await sendMessage.mutateAsync({
      conversationId: Number(id),
      data: { content }
    });
    setContent("");
    refetch();
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.messageBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: fonts.sans }}>{item.content}</Text>
          </View>
        )}
      />
      
      <View style={[styles.inputRow, { paddingBottom: insets.bottom || 16, borderTopColor: colors.border, backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          value={content}
          onChangeText={setContent}
        />
        <Pressable onPress={handleSend} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontFamily: fonts.sansMedium }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageBubble: { padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 8, alignSelf: "flex-start", maxWidth: "80%" },
  inputRow: { flexDirection: "row", padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, fontFamily: fonts.sans },
  sendBtn: { paddingHorizontal: 16, justifyContent: "center", borderRadius: 20 },
});
