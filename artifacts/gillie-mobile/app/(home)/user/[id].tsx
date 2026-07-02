import { boatLabelFor } from "@workspace/boat-config";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Dimensions,
} from "react-native";
import {
  useGetUser,
  useGetPosts,
  useGetPins,
  useGetCatches,
  useGetGallery,
  useGetFollowers,
  useGetFollowing,
  useFollowUser,
  useUnfollowUser,
  useCreateConversation,
  getGetUserQueryKey,
  getGetPinsQueryKey,
  getGetCatchesQueryKey,
  getGetGalleryQueryKey,
  getGetFollowersQueryKey,
  getGetFollowingQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import ScreenHeader from "@/components/ui/ScreenHeader";
import SoftCard from "@/components/ui/SoftCard";
import Chip from "@/components/ui/Chip";
import SectionHeader from "@/components/ui/SectionHeader";
import WaveDivider from "@/components/ui/WaveDivider";
import RankBadge from "@/components/ui/RankBadge";
import {
  ProfileHero,
  StatRow,
  AchievementGrid,
  RecentActivity,
  GalleryPreview,
  AboutRows,
  buildRecentActivity,
  prettify,
  type IoniconName,
} from "@/components/ProfileSections";
import { resolveAssetUrl } from "@/lib/format";

const { width } = Dimensions.get("window");

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch, isRefetching } = useGetUser(userId, {
    query: { enabled: Number.isFinite(userId), queryKey: getGetUserQueryKey(userId) },
  });

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const createConversation = useCreateConversation();

  const [tab, setTab] = useState<"posts" | "pins" | "gallery">("posts");

  const { data: posts } = useGetPosts();
  const { data: pins } = useGetPins(
    { profileUserId: userId },
    { query: { enabled: Number.isFinite(userId), queryKey: getGetPinsQueryKey({ profileUserId: userId }) } },
  );
  const { data: catches } = useGetCatches(
    { profileUserId: userId },
    { query: { enabled: Number.isFinite(userId), queryKey: getGetCatchesQueryKey({ profileUserId: userId }) } },
  );
  const { data: gallery } = useGetGallery(
    { profileUserId: userId },
    { query: { enabled: Number.isFinite(userId), queryKey: getGetGalleryQueryKey({ profileUserId: userId }) } },
  );
  const { data: followers } = useGetFollowers(userId, {
    query: { enabled: Number.isFinite(userId), queryKey: getGetFollowersQueryKey(userId) },
  });
  const { data: following } = useGetFollowing(userId, {
    query: { enabled: Number.isFinite(userId), queryKey: getGetFollowingQueryKey(userId) },
  });

  if (isLoading || !user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const userPosts = posts?.filter((p) => p.userId === userId) || [];
  const userPins = pins || [];
  const userCatches = catches || [];
  const userGallery = gallery || [];

  const followersCount = followers?.length ?? user.followerCount ?? 0;
  const followingCount = following?.length ?? user.followingCount ?? 0;

  const friendStatus = user.friendStatus;
  const isSelf = friendStatus === "self";
  const isFollowing = friendStatus === "accepted" || friendStatus === "pending_out";
  const isPending = friendStatus === "pending_out";

  const toggleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowUser.mutateAsync({ userId });
      } else {
        await followUser.mutateAsync({ userId });
      }
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: getGetFollowersQueryKey(userId) });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMessage = async () => {
    try {
      const convo = await createConversation.mutateAsync({ data: { participantId: userId } });
      router.push(`/conversation/${convo.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const aboutRows: { icon: IoniconName; label: string }[] = [];
  if (user.location) aboutRows.push({ icon: "location-outline", label: `Lives in ${user.location}` });
  if (user.hometown) aboutRows.push({ icon: "home-outline", label: `From ${user.hometown}` });
  if (user.work) aboutRows.push({ icon: "briefcase-outline", label: user.work });
  if (user.birthday) aboutRows.push({ icon: "gift-outline", label: user.birthday });
  if (user.relationshipStatus)
    aboutRows.push({ icon: "heart-outline", label: prettify(user.relationshipStatus) });
  if (user.boatName)
    aboutRows.push({
      icon: "boat-outline",
      label: user.boatType
        ? `${user.boatName} · ${boatLabelFor(user.boatType)}${user.boatBrand ? ` • ${user.boatBrand}` : ""}`
        : user.boatName,
    });

  const interests = user.interests || [];
  const badges = user.badges || [];
  const recent = buildRecentActivity({
    posts: userPosts,
    catches: userCatches,
    pins: userPins,
    gallery: userGallery,
  });

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "pins", label: "Pins" },
    { key: "gallery", label: "Gallery" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={user.displayName} back />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Hero cover + overlapping identity card */}
        <ProfileHero user={user}>
          <StatRow
            stats={[
              { label: "Posts", value: userPosts.length, onPress: () => setTab("posts") },
              { label: "Followers", value: followersCount },
              { label: "Following", value: followingCount },
              { label: "Catches", value: userCatches.length, star: true },
            ]}
          />

          {!isSelf ? (
            <View style={styles.actionsRow}>
              <Pressable
                style={[
                  styles.followButton,
                  {
                    backgroundColor: isFollowing ? colors.card : colors.primary,
                    borderColor: isFollowing ? colors.border : colors.primary,
                  },
                ]}
                onPress={toggleFollow}
                disabled={followUser.isPending || unfollowUser.isPending}
              >
                <Ionicons
                  name={isFollowing ? "checkmark" : "person-add"}
                  size={17}
                  color={isFollowing ? colors.foreground : colors.primaryForeground}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.followText,
                    { color: isFollowing ? colors.foreground : colors.primaryForeground },
                  ]}
                >
                  {isPending ? "Requested" : isFollowing ? "Following" : "Follow"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleMessage}
                disabled={createConversation.isPending}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
        </ProfileHero>

        {/* About Me */}
        {aboutRows.length > 0 || user.bio || user.rank ? (
          <View style={styles.section}>
            <SoftCard>
              <SectionHeader title="About Me" icon="person-circle-outline" />
              {user.bio ? (
                <Text style={[styles.bio, { color: colors.foreground }]}>{user.bio}</Text>
              ) : null}
              {user.rank ? (
                <View style={styles.rankRow}>
                  <RankBadge tier={user.rank.tier} title={user.rank.title} size={56} />
                </View>
              ) : null}
              {aboutRows.length > 0 ? (
                <AboutRows rows={aboutRows} />
              ) : !user.bio ? (
                <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                  No details shared yet.
                </Text>
              ) : null}
            </SoftCard>
          </View>
        ) : null}

        {/* Interests */}
        {interests.length > 0 ? (
          <View style={styles.section}>
            <SoftCard>
              <SectionHeader title="Interests" icon="heart-outline" />
              <View style={styles.chipWrap}>
                {interests.map((it) => (
                  <Chip key={it} label={prettify(it)} tone="primary" active />
                ))}
              </View>
            </SoftCard>
          </View>
        ) : null}

        {/* Achievements */}
        {badges.length > 0 ? (
          <View style={styles.section}>
            <SoftCard>
              <SectionHeader title="Achievements" icon="ribbon-outline" />
              <AchievementGrid badges={badges} />
            </SoftCard>
          </View>
        ) : null}

        <WaveDivider />

        {/* Lake Adventures (gallery preview) */}
        <View style={styles.section}>
          <SoftCard>
            <SectionHeader
              title="Lake Adventures"
              icon="camera-outline"
              actionLabel={userGallery.length > 0 ? "See all" : undefined}
              onAction={userGallery.length > 0 ? () => setTab("gallery") : undefined}
            />
            <GalleryPreview gallery={userGallery} emptyText="No photos shared yet." />
          </SoftCard>
        </View>

        <WaveDivider />

        {/* Recent Activity */}
        <View style={styles.section}>
          <SoftCard>
            <SectionHeader title="Recent Activity" icon="time-outline" />
            <RecentActivity items={recent} />
          </SoftCard>
        </View>

        {/* Section tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              style={[
                styles.tab,
                tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t.key ? colors.primary : colors.mutedForeground },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {tab === "posts" &&
            (userPosts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No posts yet.</Text>
            ) : (
              userPosts.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/post/${p.id}`)}
                  style={{ marginBottom: 12 }}
                >
                  <SoftCard>
                    <Text style={[styles.postTitle, { color: colors.foreground }]}>{p.title}</Text>
                    {p.content ? (
                      <Text
                        style={[styles.postContent, { color: colors.mutedForeground }]}
                        numberOfLines={2}
                      >
                        {p.content}
                      </Text>
                    ) : null}
                    {p.imageUrl ? (
                      <Image
                        source={{ uri: resolveAssetUrl(p.imageUrl) }}
                        style={styles.postImage}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : null}
                  </SoftCard>
                </Pressable>
              ))
            ))}

          {tab === "pins" &&
            (userPins.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pins dropped.</Text>
            ) : (
              userPins.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/pin/${p.id}`)}
                  style={{ marginBottom: 12 }}
                >
                  <SoftCard>
                    <Text style={[styles.postTitle, { color: colors.foreground }]}>{p.title}</Text>
                    {p.description ? (
                      <Text
                        style={[styles.postContent, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {p.description}
                      </Text>
                    ) : null}
                  </SoftCard>
                </Pressable>
              ))
            ))}

          {tab === "gallery" && (
            <View style={styles.galleryGrid}>
              {userGallery.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No photos yet.</Text>
              ) : (
                userGallery.map((g) => (
                  <Image
                    key={g.id}
                    source={{ uri: resolveAssetUrl(g.mediaUrl) }}
                    style={styles.galleryImg}
                    contentFit="cover"
                  />
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16, width: "100%" },
  followButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
  },
  followText: { fontFamily: fonts.sansBold, fontSize: 15 },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  section: { paddingHorizontal: 16, marginTop: 16 },
  bio: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  rankRow: { marginBottom: 14 },
  muted: { fontFamily: fonts.sans, fontSize: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabsRow: { flexDirection: "row", borderBottomWidth: 1, marginTop: 20, paddingHorizontal: 8 },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  tabContent: { paddingHorizontal: 16, paddingTop: 16 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, textAlign: "center", marginTop: 32 },
  postTitle: { fontFamily: fonts.displaySemibold, fontSize: 17, marginBottom: 4 },
  postContent: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  postImage: { width: "100%", height: 180, borderRadius: 12, marginTop: 12 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  galleryImg: { width: (width - 32) / 3 - 8, height: (width - 32) / 3 - 8, borderRadius: 8, margin: 4 },
});
