import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import { useGetConversations } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: convos, isLoading } = useGetConversations();

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
        data={convos}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/conversation/${item.id}`)}
          >
            <Text style={[styles.title, { color: colors.foreground }]}>
              {item.name || "Conversation"}
            </Text>
            {item.lastMessage && (
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>
                {item.lastMessage.content}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 4 },
});
