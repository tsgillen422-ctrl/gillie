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
  useGetMe,
  useGetPosts,
  useGetPins,
  useGetCatches,
  useGetGallery,
  useGetFriends,
  useGetFollowers,
  useGetFollowing,
  useGetFavoritePins,
  getGetPinsQueryKey,
  getGetCatchesQueryKey,
  getGetGalleryQueryKey,
  getGetFollowersQueryKey,
  getGetFollowingQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/expo";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/components/AppHeader";
import { UserAvatar } from "@/components/UserAvatar";
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
import { resolveAssetUrl, timeAgo } from "@/lib/format";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useClerk();
  const { data: user, isLoading, refetch, isRefetching } = useGetMe();

  const [tab, setTab] = useState<"posts" | "pins" | "gallery">("posts");

  const { data: posts } = useGetPosts();
  const { data: friends } = useGetFriends();
  const { data: pins } = useGetPins(user ? { profileUserId: user.id } : {}, {
    query: {
      enabled: !!user?.id,
      queryKey: getGetPinsQueryKey(user ? { profileUserId: user.id } : {}),
    },
  });
  const { data: catches } = useGetCatches(
    user ? { profileUserId: user.id } : {},
    {
      query: {
        enabled: !!user?.id,
        queryKey: getGetCatchesQueryKey(user ? { profileUserId: user.id } : {}),
      },
    },
  );
  const { data: gallery } = useGetGallery(
    user ? { profileUserId: user.id } : {},
    {
      query: {
        enabled: !!user?.id,
        queryKey: getGetGalleryQueryKey(user ? { profileUserId: user.id } : {}),
      },
    },
  );
  const { data: followers } = useGetFollowers(user?.id ?? 0, {
    query: {
      enabled: !!user?.id,
      queryKey: getGetFollowersQueryKey(user?.id ?? 0),
    },
  });
  const { data: following } = useGetFollowing(user?.id ?? 0, {
    query: {
      enabled: !!user?.id,
      queryKey: getGetFollowingQueryKey(user?.id ?? 0),
    },
  });
  const { data: favoritePins } = useGetFavoritePins();

  if (isLoading || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const userPosts = posts?.filter((p) => p.userId === user.id) || [];
  const userPins = pins || [];
  const userCatches = catches || [];
  const userGallery = gallery || [];

  const followersCount = followers?.length ?? user.followerCount ?? 0;
  const followingCount = following?.length ?? user.followingCount ?? 0;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const aboutRows: { icon: IoniconName; label: string }[] = [];
  if (user.location)
    aboutRows.push({ icon: "location-outline", label: `Lives in ${user.location}` });
  if (user.hometown)
    aboutRows.push({ icon: "home-outline", label: `From ${user.hometown}` });
  if (user.work) aboutRows.push({ icon: "briefcase-outline", label: user.work });
  if (user.birthday)
    aboutRows.push({ icon: "gift-outline", label: user.birthday });
  if (user.relationshipStatus)
    aboutRows.push({
      icon: "heart-outline",
      label: prettify(user.relationshipStatus),
    });
  if (user.boatName)
    aboutRows.push({
      icon: "boat-outline",
      label: user.boatType
        ? `${user.boatName} · ${boatLabelFor(user.boatType)}`
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
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero cover + overlapping identity card */}
        <ProfileHero user={user}>
          <StatRow
            stats={[
              { label: "Posts", value: userPosts.length, onPress: () => setTab("posts") },
              { label: "Followers", value: followersCount },
              { label: "Following", value: followingCount },
              {
                label: "Favorites",
                value: favoritePins?.length ?? 0,
                star: true,
                onPress: () => router.push("/(home)/(tabs)" as any),
              },
            ]}
          />

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/settings")}
            >
              <Feather
                name="edit-2"
                size={16}
                color={colors.primaryForeground}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[styles.primaryButtonText, { color: colors.primaryForeground }]}
              >
                Edit Profile
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.iconButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={handleSignOut}
            >
              <Feather name="log-out" size={18} color={colors.destructive} />
            </Pressable>
          </View>

          <Pressable
            style={[styles.mapButton, { borderColor: colors.border }]}
            onPress={() => router.push("/(home)/(tabs)" as any)}
          >
            <Ionicons
              name="location-outline"
              size={16}
              color={colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.mapButtonText, { color: colors.foreground }]}>
              Find me on Map
            </Text>
          </Pressable>
        </ProfileHero>

        {/* About Me */}
        <View style={styles.section}>
          <SoftCard>
            <SectionHeader title="About Me" icon="person-circle-outline" />
            {user.bio ? (
              <Text style={[styles.bio, { color: colors.foreground }]}>
                {user.bio}
              </Text>
            ) : null}
            {user.rank ? (
              <View style={styles.rankRow}>
                <RankBadge
                  tier={user.rank.tier}
                  title={user.rank.title}
                  size={56}
                />
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
              onAction={
                userGallery.length > 0 ? () => setTab("gallery") : undefined
              }
            />
            <GalleryPreview
              gallery={userGallery}
              emptyText="Share your first lake adventure below."
            />
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
                tab === t.key && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: tab === t.key ? colors.primary : colors.mutedForeground,
                  },
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
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                You haven't posted yet.
              </Text>
            ) : (
              userPosts.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/post/${p.id}`)}
                  style={{ marginBottom: 12 }}
                >
                  <SoftCard>
                    <Text style={[styles.postTitle, { color: colors.foreground }]}>
                      {p.title}
                    </Text>
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
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                You haven't dropped any pins.
              </Text>
            ) : (
              userPins.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/pin/${p.id}`)}
                  style={{ marginBottom: 12 }}
                >
                  <SoftCard>
                    <Text style={[styles.postTitle, { color: colors.foreground }]}>
                      {p.title}
                    </Text>
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
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Add your first photos and videos.
                </Text>
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
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryButtonText: { fontFamily: fonts.sansBold, fontSize: 15 },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  mapButton: {
    marginTop: 10,
    width: "100%",
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  bio: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  rankRow: { marginBottom: 14 },
  muted: { fontFamily: fonts.sans, fontSize: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  tabContent: { paddingHorizontal: 16, paddingTop: 16 },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    textAlign: "center",
    marginTop: 32,
  },
  postTitle: { fontFamily: fonts.displaySemibold, fontSize: 17, marginBottom: 4 },
  postContent: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  postImage: { width: "100%", height: 180, borderRadius: 12, marginTop: 12 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  galleryImg: {
    width: (width - 32) / 3 - 8,
    height: (width - 32) / 3 - 8,
    borderRadius: 8,
    margin: 4,
  },
});
