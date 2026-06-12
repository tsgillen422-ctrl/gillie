import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useGetPosts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: posts, isLoading, refetch, isRefetching } = useGetPosts();

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
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/post/${item.id}`)}
          >
            <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
            <Text style={[styles.content, { color: colors.mutedForeground }]}>{item.content}</Text>
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
  content: { fontFamily: fonts.sans, fontSize: 14 },
});
