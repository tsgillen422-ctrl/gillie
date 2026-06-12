import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import { useGetNotifications } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: notifications, isLoading } = useGetNotifications();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.foreground, margin: 24, marginBottom: 12 }]}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.content, { color: colors.foreground }]}>{item.message}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 28 },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  content: { fontFamily: fonts.sans, fontSize: 15 },
});
