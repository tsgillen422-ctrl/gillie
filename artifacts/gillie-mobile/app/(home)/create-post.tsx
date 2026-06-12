import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useCreatePost } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function CreatePostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  
  const createPost = useCreatePost();

  const handlePost = async () => {
    if (!title || !content) return;
    await createPost.mutateAsync({
      data: { title, content, postType: "post" }
    });
    router.back();
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, padding: 24 }]}>
      <Text style={[styles.header, { color: colors.foreground }]}>Create Post</Text>
      
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
        placeholder="Title"
        placeholderTextColor={colors.mutedForeground}
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={[styles.textArea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
        placeholder="What's going on?"
        placeholderTextColor={colors.mutedForeground}
        multiline
        value={content}
        onChangeText={setContent}
      />

      <Pressable
        style={[styles.button, { backgroundColor: colors.primary, opacity: createPost.isPending ? 0.7 : 1 }]}
        onPress={handlePost}
        disabled={createPost.isPending || !title || !content}
      >
        {createPost.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Post</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.displayBold, fontSize: 24, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.sans,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.sans,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
  },
});
