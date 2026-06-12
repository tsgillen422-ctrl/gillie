import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useCreatePost, getGetPostsQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

const POST_TYPES = [
  { id: "post", label: "Post" },
  { id: "event", label: "Event" },
  { id: "business", label: "Business" },
  { id: "tie_up", label: "Tie Up" },
];

export default function CreatePostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"post" | "event" | "business" | "tie_up" | "boat_showcase">("post");
  
  const createPost = useCreatePost();

  const handlePost = async () => {
    if (!title || !content) return;
    await createPost.mutateAsync({
      data: { title, content, postType }
    });
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    router.back();
  };

  return (
    <KeyboardAvoidingView 
      style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.navHeader}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Create Post</Text>
        <Pressable
          style={[styles.postBtn, { backgroundColor: (!title || !content) ? colors.muted : colors.primary }]}
          onPress={handlePost}
          disabled={createPost.isPending || !title || !content}
        >
          {createPost.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.postBtnText, { color: (!title || !content) ? colors.mutedForeground : colors.primaryForeground }]}>Post</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.typeSelector}>
          {POST_TYPES.map(type => (
            <Pressable
              key={type.id}
              style={[
                styles.typeBtn,
                { 
                  backgroundColor: postType === type.id ? colors.primary : colors.card,
                  borderColor: colors.border
                }
              ]}
              onPress={() => setPostType(type.id as any)}
            >
              <Text style={[
                styles.typeBtnText, 
                { color: postType === type.id ? colors.primaryForeground : colors.foreground }
              ]}>
                {type.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[styles.titleInput, { color: colors.foreground }]}
          placeholder="Title"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        <TextInput
          style={[styles.contentInput, { color: colors.foreground }]}
          placeholder="What's going on?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ccc" },
  backBtn: { padding: 8 },
  navTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  postBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { fontFamily: fonts.sansBold, fontSize: 14 },
  
  typeSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  typeBtnText: { fontFamily: fonts.sansMedium, fontSize: 14 },

  titleInput: { fontFamily: fonts.displaySemibold, fontSize: 24, marginBottom: 16, paddingVertical: 8 },
  contentInput: { fontFamily: fonts.sans, fontSize: 16, minHeight: 150, paddingVertical: 8, lineHeight: 24 },
});
