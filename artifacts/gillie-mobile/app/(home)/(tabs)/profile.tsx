import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, Dimensions } from "react-native";
import { useGetMe, useGetPosts, useGetPins, useGetCatches, useGetGallery, getGetPinsQueryKey, getGetCatchesQueryKey, getGetGalleryQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/expo";
import { UserAvatar } from "@/components/UserAvatar";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { resolveAssetUrl, timeAgo } from "@/lib/format";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useClerk();
  const { data: user, isLoading, refetch, isRefetching } = useGetMe();

  const [tab, setTab] = useState<"posts" | "pins" | "catches" | "gallery">("posts");

  const { data: posts } = useGetPosts();
  const { data: pins } = useGetPins(user ? { profileUserId: user.id } : {}, { query: { enabled: !!user?.id, queryKey: getGetPinsQueryKey(user ? { profileUserId: user.id } : {}) } });
  const { data: catches } = useGetCatches(user ? { profileUserId: user.id } : {}, { query: { enabled: !!user?.id, queryKey: getGetCatchesQueryKey(user ? { profileUserId: user.id } : {}) } });
  const { data: gallery } = useGetGallery(user ? { profileUserId: user.id } : {}, { query: { enabled: !!user?.id, queryKey: getGetGalleryQueryKey(user ? { profileUserId: user.id } : {}) } });

  if (isLoading || !user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const userPosts = posts?.filter((p) => p.userId === user.id) || [];
  const userPins = pins || [];
  const userCatches = catches || [];
  const userGallery = gallery || [];

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={{ paddingHorizontal: 24, alignItems: "center" }}>
          <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} size={100} online={user.isOnline} />
          <Text style={[styles.name, { color: colors.foreground, marginTop: 16 }]}>{user.displayName}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sansMedium, fontSize: 16, marginBottom: 16 }}>@{user.username}</Text>
          
          {user.bio ? (
            <Text style={{ color: colors.foreground, fontFamily: fonts.sans, fontSize: 15, textAlign: "center", marginBottom: 20 }}>{user.bio}</Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{userPosts.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Posts</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{user.followerCount || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Followers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{userCatches.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Catches</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => router.push("/settings")}
            >
              <Feather name="settings" size={18} color={colors.primaryForeground} style={{ marginRight: 6 }} />
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Edit Profile</Text>
            </Pressable>

            <Pressable
              style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleSignOut}
            >
              <Feather name="log-out" size={20} color={colors.destructive} />
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
          {(["posts", "pins", "catches", "gallery"] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {tab === "posts" && (
            userPosts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No posts yet.</Text>
            ) : (
              userPosts.map(p => (
                <Pressable key={p.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/post/${p.id}`)}>
                  <Text style={[styles.postTitle, { color: colors.foreground }]}>{p.title}</Text>
                  <Text style={[styles.postContent, { color: colors.mutedForeground }]} numberOfLines={2}>{p.content}</Text>
                </Pressable>
              ))
            )
          )}

          {tab === "catches" && (
            userCatches.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No catches yet.</Text>
            ) : (
              userCatches.map(c => (
                <View key={c.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center" }]}>
                  {c.imageUrl && (
                    <Image source={{ uri: resolveAssetUrl(c.imageUrl) }} style={styles.catchImg} contentFit="cover" />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postTitle, { color: colors.foreground }]}>{c.species}</Text>
                    {c.weight != null && <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>{c.weight} lbs</Text>}
                    <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 12, marginTop: 4 }}>{timeAgo(c.caughtAt)}</Text>
                  </View>
                </View>
              ))
            )
          )}

          {tab === "gallery" && (
            <View style={styles.galleryGrid}>
              {userGallery.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No photos yet.</Text>
              ) : (
                userGallery.map(g => (
                  <Image key={g.id} source={{ uri: resolveAssetUrl(g.mediaUrl) }} style={styles.galleryImg} contentFit="cover" />
                ))
              )}
            </View>
          )}

          {tab === "pins" && (
            userPins.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pins yet.</Text>
            ) : (
              userPins.map(p => (
                <Pressable key={p.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/pin/${p.id}`)}>
                  <Text style={[styles.postTitle, { color: colors.foreground }]}>{p.title}</Text>
                  <Text style={[styles.postContent, { color: colors.mutedForeground }]} numberOfLines={1}>{p.description}</Text>
                </Pressable>
              ))
            )
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontFamily: fonts.displayBold, fontSize: 24, textAlign: "center" },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 20, width: "100%" },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 20, marginBottom: 2 },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 13 },
  statDivider: { width: 1, height: 30 },
  actionsRow: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 10 },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tabsContainer: { flexDirection: "row", borderBottomWidth: 1, marginTop: 16 },
  tab: { flex: 1, paddingVertical: 16, alignItems: "center" },
  tabText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, textAlign: "center", marginTop: 40 },
  postCard: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 12 },
  postTitle: { fontFamily: fonts.displaySemibold, fontSize: 17, marginBottom: 4 },
  postContent: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  catchImg: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  galleryImg: { width: (width - 32) / 3 - 8, height: (width - 32) / 3 - 8, borderRadius: 8, margin: 4 },
});
