import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useGetFriends } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: friends, isLoading } = useGetFriends();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.foreground, margin: 24, marginBottom: 12 }]}>Friends</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.foreground }]}>{item.displayName}</Text>
            <Text style={[styles.username, { color: colors.mutedForeground }]}>@{item.username}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 28 },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  name: { fontFamily: fonts.sansSemibold, fontSize: 16 },
  username: { fontFamily: fonts.sans, fontSize: 14 },
});
