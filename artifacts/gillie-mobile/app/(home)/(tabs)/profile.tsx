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
  getGetPinsQueryKey,
  getGetCatchesQueryKey,
  getGetGalleryQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/components/AppHeader";
import { UserAvatar } from "@/components/UserAvatar";
import SoftCard from "@/components/ui/SoftCard";
import StatCard from "@/components/ui/StatCard";
import Chip from "@/components/ui/Chip";
import SectionHeader from "@/components/ui/SectionHeader";
import WaveDivider from "@/components/ui/WaveDivider";
import RankBadge from "@/components/ui/RankBadge";
import { resolveAssetUrl, timeAgo } from "@/lib/format";

const { width } = Dimensions.get("window");

type IoniconName = keyof typeof Ionicons.glyphMap;

function prettify(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useClerk();
  const { data: user, isLoading, refetch, isRefetching } = useGetMe();

  const [tab, setTab] = useState<"posts" | "catches" | "pins" | "gallery">(
    "posts",
  );

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
        queryKey: getGetCatchesQueryKey(
          user ? { profileUserId: user.id } : {},
        ),
      },
    },
  );
  const { data: gallery } = useGetGallery(
    user ? { profileUserId: user.id } : {},
    {
      query: {
        enabled: !!user?.id,
        queryKey: getGetGalleryQueryKey(
          user ? { profileUserId: user.id } : {},
        ),
      },
    },
  );

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
  const friendCount = friends?.length || 0;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const aboutRows: { icon: IoniconName; label: string }[] = [];
  if (user.location)
    aboutRows.push({ icon: "location-outline", label: user.location });
  if (user.hometown)
    aboutRows.push({ icon: "home-outline", label: `From ${user.hometown}` });
  if (user.work)
    aboutRows.push({ icon: "briefcase-outline", label: user.work });
  if (user.relationshipStatus)
    aboutRows.push({
      icon: "heart-outline",
      label: prettify(user.relationshipStatus),
    });
  if (user.birthday)
    aboutRows.push({ icon: "gift-outline", label: user.birthday });
  if (user.boatName)
    aboutRows.push({
      icon: "boat-outline",
      label: user.boatType
        ? `${user.boatName} · ${prettify(user.boatType)}`
        : user.boatName,
    });

  const interests = user.interests || [];
  const badges = user.badges || [];

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "catches", label: "Catches" },
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
        {/* Gradient hero */}
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        />

        <View style={styles.heroBody}>
          <View style={[styles.avatarRing, { backgroundColor: colors.card }]}>
            <UserAvatar
              name={user.displayName}
              username={user.username}
              avatarUrl={user.avatarUrl}
              size={92}
              online={user.isOnline}
            />
          </View>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {user.displayName}
          </Text>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>
            @{user.username}
          </Text>
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
                size={44}
              />
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.editButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/settings")}
            >
              <Feather
                name="edit-2"
                size={16}
                color={colors.primaryForeground}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.editButtonText,
                  { color: colors.primaryForeground },
                ]}
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
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <SoftCard padded={false} style={styles.statsCard}>
            <StatCard
              value={userPosts.length}
              label="Posts"
              onPress={() => setTab("posts")}
            />
            <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
            <StatCard
              value={userCatches.length}
              label="Catches"
              onPress={() => setTab("catches")}
            />
            <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
            <StatCard
              value={userPins.length}
              label="Pins"
              onPress={() => setTab("pins")}
            />
            <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
            <StatCard
              value={friendCount}
              label="Friends"
              onPress={() => router.push("/friends")}
            />
          </SoftCard>
        </View>

        {/* About */}
        {aboutRows.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="About" icon="person-circle-outline" />
            <SoftCard>
              {aboutRows.map((row, i) => (
                <View
                  key={row.icon + i}
                  style={[styles.aboutRow, i > 0 && { marginTop: 12 }]}
                >
                  <Ionicons
                    name={row.icon}
                    size={18}
                    color={colors.primary}
                    style={{ width: 26 }}
                  />
                  <Text
                    style={[styles.aboutText, { color: colors.foreground }]}
                  >
                    {row.label}
                  </Text>
                </View>
              ))}
            </SoftCard>
          </View>
        ) : null}

        {/* Interests */}
        {interests.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Interests" icon="sparkles-outline" />
            <View style={styles.chipWrap}>
              {interests.map((it) => (
                <Chip key={it} label={prettify(it)} tone="primary" active />
              ))}
            </View>
          </View>
        ) : null}

        {/* Badges */}
        {badges.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Badges" icon="ribbon-outline" />
            <View style={styles.chipWrap}>
              {badges.map((b) => (
                <Chip
                  key={b.key}
                  label={b.label}
                  icon={b.earned ? "ribbon" : "lock-closed-outline"}
                  tone={b.earned ? "accent" : "muted"}
                  active={b.earned}
                />
              ))}
            </View>
          </View>
        ) : null}

        <WaveDivider />

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
                    color:
                      tab === t.key ? colors.primary : colors.mutedForeground,
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
                No posts yet.
              </Text>
            ) : (
              userPosts.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/post/${p.id}`)}
                  style={{ marginBottom: 12 }}
                >
                  <SoftCard>
                    <Text
                      style={[styles.postTitle, { color: colors.foreground }]}
                    >
                      {p.title}
                    </Text>
                    <Text
                      style={[
                        styles.postContent,
                        { color: colors.mutedForeground },
                      ]}
                      numberOfLines={2}
                    >
                      {p.content}
                    </Text>
                  </SoftCard>
                </Pressable>
              ))
            ))}

          {tab === "catches" &&
            (userCatches.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No catches yet.
              </Text>
            ) : (
              userCatches.map((c) => (
                <View key={c.id} style={{ marginBottom: 12 }}>
                  <SoftCard>
                    <View style={styles.catchRow}>
                      {c.imageUrl ? (
                        <Image
                          source={{ uri: resolveAssetUrl(c.imageUrl) }}
                          style={styles.catchImg}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.catchImg,
                            styles.catchImgPlaceholder,
                            { backgroundColor: colors.muted },
                          ]}
                        >
                          <Ionicons
                            name="fish"
                            size={24}
                            color={colors.mutedForeground}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.postTitle,
                            { color: colors.foreground },
                          ]}
                        >
                          {c.species}
                        </Text>
                        {c.weight != null ? (
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontFamily: fonts.sans,
                            }}
                          >
                            {c.weight} lbs
                          </Text>
                        ) : null}
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontFamily: fonts.sans,
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {timeAgo(c.caughtAt)}
                        </Text>
                      </View>
                    </View>
                  </SoftCard>
                </View>
              ))
            ))}

          {tab === "pins" &&
            (userPins.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No pins yet.
              </Text>
            ) : (
              userPins.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/pin/${p.id}`)}
                  style={{ marginBottom: 12 }}
                >
                  <SoftCard>
                    <Text
                      style={[styles.postTitle, { color: colors.foreground }]}
                    >
                      {p.title}
                    </Text>
                    <Text
                      style={[
                        styles.postContent,
                        { color: colors.mutedForeground },
                      ]}
                      numberOfLines={1}
                    >
                      {p.description}
                    </Text>
                  </SoftCard>
                </Pressable>
              ))
            ))}

          {tab === "gallery" && (
            <View style={styles.galleryGrid}>
              {userGallery.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  No photos yet.
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
  hero: { height: 120, width: "100%" },
  heroBody: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: -50,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    textAlign: "center",
    marginTop: 12,
  },
  username: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    marginTop: 2,
  },
  bio: {
    fontFamily: fonts.sans,
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 21,
  },
  rankRow: { marginTop: 16 },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    width: "100%",
  },
  editButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  editButtonText: { fontFamily: fonts.sansBold, fontSize: 15 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  section: { paddingHorizontal: 16, marginTop: 20 },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  vDivider: { width: 1, height: 30 },
  aboutRow: { flexDirection: "row", alignItems: "center" },
  aboutText: { fontFamily: fonts.sansMedium, fontSize: 15, flex: 1 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginTop: 8,
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
  catchRow: { flexDirection: "row", alignItems: "center" },
  catchImg: { width: 60, height: 60, borderRadius: 10, marginRight: 12 },
  catchImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  galleryImg: {
    width: (width - 32) / 3 - 8,
    height: (width - 32) / 3 - 8,
    borderRadius: 8,
    margin: 4,
  },
});
