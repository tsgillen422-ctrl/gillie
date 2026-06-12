import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useGetPost, useGetPostComments, useReactToPost, useReactToComment, useCreatePostComment, getGetPostCommentsQueryKey, getGetPostQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import UserAvatar from "@/components/UserAvatar";
import { timeAgo, resolveAssetUrl } from "@/lib/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const postId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: post, isLoading: postLoading } = useGetPost(postId);
  const { data: comments, isLoading: commentsLoading } = useGetPostComments(postId);
  
  const reactPost = useReactToPost();
  const reactComment = useReactToComment();
  const createComment = useCreatePostComment();

  const [newComment, setNewComment] = useState("");

  const handleReactPost = async () => {
    if (!post) return;
    const reaction = post.myReaction === "thumbsup" ? "thumbsup" : "thumbsup"; // simplify
    await reactPost.mutateAsync({ postId, data: { reaction: post.myReaction ? "thumbsup" : "thumbsup" } }); // toggle logic would go here
    queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
  };

  const handleReactComment = async (commentId: number) => {
    await reactComment.mutateAsync({ postId, commentId, data: { reaction: "heart" } });
    queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(postId) });
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    await createComment.mutateAsync({ postId, data: { content: newComment.trim() } });
    setNewComment("");
    queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(postId) });
  };

  if (postLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: fonts.sans }}>Post not found.</Text>
      </View>
    );
  }

  const renderComment = ({ item }: { item: any }) => (
    <View style={[styles.commentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.commentHeader}>
        <UserAvatar name={item.user?.displayName} username={item.user?.username} avatarUrl={item.user?.avatarUrl} size={32} />
        <View style={styles.commentAuthorInfo}>
          <Text style={[styles.authorName, { color: colors.foreground, fontSize: 14 }]}>{item.user?.displayName}</Text>
          <Text style={[styles.timeAgo, { color: colors.mutedForeground, fontSize: 11 }]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>
      <Text style={[styles.content, { color: colors.foreground, fontSize: 14, marginTop: 8 }]}>{item.content}</Text>
      <View style={styles.commentFooter}>
        <Pressable onPress={() => handleReactComment(item.id)} style={styles.actionBtn}>
          <Ionicons name={item.myReaction ? "heart" : "heart-outline"} size={16} color={item.myReaction ? colors.destructive : colors.mutedForeground} />
          <Text style={[styles.actionText, { color: colors.mutedForeground, fontSize: 12 }]}>{item.likeCount || 0}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.navHeader}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <View style={styles.header}>
              <Pressable onPress={() => router.push(`/user/${post.userId}`)} style={styles.authorRow}>
                <UserAvatar name={post.user?.displayName} username={post.user?.username} avatarUrl={post.user?.avatarUrl} size={48} />
                <View style={styles.authorInfo}>
                  <Text style={[styles.authorName, { color: colors.foreground, fontSize: 18 }]}>{post.user?.displayName}</Text>
                  <Text style={[styles.timeAgo, { color: colors.mutedForeground, fontSize: 14 }]}>
                    @{post.user?.username} • {timeAgo(post.createdAt)}
                  </Text>
                </View>
              </Pressable>
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>{post.title}</Text>
            <Text style={[styles.content, { color: colors.foreground, fontSize: 16 }]}>{post.content}</Text>
            
            {post.imageUrl && (
              <Image source={{ uri: resolveAssetUrl(post.imageUrl) }} style={styles.postImage} contentFit="cover" />
            )}

            <View style={[styles.postFooter, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <Pressable style={styles.actionBtn} onPress={handleReactPost}>
                <Ionicons name={post.myReaction ? "heart" : "heart-outline"} size={24} color={post.myReaction ? colors.destructive : colors.mutedForeground} />
                <Text style={[styles.actionText, { color: post.myReaction ? colors.destructive : colors.mutedForeground, fontSize: 16 }]}>
                  {post.likeCount || 0} Likes
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.commentsTitle, { color: colors.foreground }]}>Comments ({comments?.length || 0})</Text>
          </View>
        }
        ListEmptyComponent={
          !commentsLoading ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans, textAlign: "center", marginTop: 24 }}>
              No comments yet. Be the first!
            </Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )
        }
        renderItem={renderComment}
      />

      <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Add a comment..."
          placeholderTextColor={colors.mutedForeground}
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <Pressable 
          style={[styles.sendBtn, { backgroundColor: newComment.trim() ? colors.primary : colors.muted }]} 
          onPress={handleSendComment}
          disabled={!newComment.trim() || createComment.isPending}
        >
          <Ionicons name="send" size={16} color={newComment.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { padding: 8 },
  navTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  authorRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  authorInfo: { marginLeft: 12, flex: 1 },
  authorName: { fontFamily: fonts.sansBold },
  timeAgo: { fontFamily: fonts.sans, marginTop: 2 },
  title: { fontFamily: fonts.displayBold, fontSize: 22, marginBottom: 12 },
  content: { fontFamily: fonts.sans, lineHeight: 24, marginBottom: 16 },
  postImage: { width: "100%", height: 250, borderRadius: 16, marginBottom: 16 },
  postFooter: { flexDirection: "row", paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 24 },
  actionBtn: { flexDirection: "row", alignItems: "center", marginRight: 24 },
  actionText: { fontFamily: fonts.sansMedium, marginLeft: 8 },
  commentsTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 16 },
  commentCard: { padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  commentHeader: { flexDirection: "row", alignItems: "center" },
  commentAuthorInfo: { marginLeft: 8, flex: 1 },
  commentFooter: { flexDirection: "row", marginTop: 8 },
  composer: { flexDirection: "row", alignItems: "flex-end", padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: 12 },
});
