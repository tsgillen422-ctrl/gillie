import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useGetPost, useGetPostComments, getGetPostQueryKey, getGetPostCommentsQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { data: post, isLoading: postLoading } = useGetPost(Number(id), { query: { enabled: Number.isFinite(Number(id)), queryKey: getGetPostQueryKey(Number(id)) }});
  const { data: comments } = useGetPostComments(Number(id), { query: { enabled: Number.isFinite(Number(id)), queryKey: getGetPostCommentsQueryKey(Number(id)) }});

  if (postLoading || !post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={{ padding: 24 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>{post.title}</Text>
        <Text style={[styles.content, { color: colors.foreground }]}>{post.content}</Text>
        
        <Text style={[styles.commentsHeader, { color: colors.foreground, marginTop: 32 }]}>Comments</Text>
        {comments?.map(comment => (
          <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: fonts.sans }}>{comment.content}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 24, marginBottom: 12 },
  content: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  commentsHeader: { fontFamily: fonts.displaySemibold, fontSize: 20, marginBottom: 12 },
  commentCard: { padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 8 },
});
