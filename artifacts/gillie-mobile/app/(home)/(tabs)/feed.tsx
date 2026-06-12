import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getGetPostsQueryKey,
  getGetSavedPostsQueryKey,
  useGetConditions,
  useGetPosts,
  useGetSavedPosts,
  useReactToPost,
  useSavePost,
  useToggleRsvp,
  useUnsavePost,
  useVotePoll,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import UserAvatar from "@/components/UserAvatar";
import Chip from "@/components/ui/Chip";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SoftCard from "@/components/ui/SoftCard";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { formatDate, resolveAssetUrl, timeAgo } from "@/lib/format";

const TABS = [
  { id: "all", label: "All" },
  { id: "friends", label: "Friends" },
  { id: "community", label: "Community" },
  { id: "event", label: "Events" },
  { id: "business", label: "Business" },
  { id: "saved", label: "Saved" },
];

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const POST_TYPE_META: Record<string, { label: string; icon: IoniconName; color: string }> = {
  event: { label: "Gathering", icon: "calendar", color: "#0ea5e9" },
  tie_up: { label: "Tie-Up", icon: "boat", color: "#0891b2" },
  business: { label: "Business", icon: "briefcase", color: "#f59e0b" },
  boat_showcase: { label: "Boat", icon: "boat", color: "#6366f1" },
  catch: { label: "Catch", icon: "fish", color: "#10b981" },
  community: { label: "Community", icon: "people", color: "#0d7fa5" },
};

export default function FeedScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const isSavedTab = activeTab === "saved";

  let feedParams: any = {};
  if (activeTab === "friends") feedParams = { audience: "friends" };
  else if (activeTab === "community") feedParams = { audience: "community" };
  else if (activeTab === "event" || activeTab === "business")
    feedParams = { type: activeTab };

  const {
    data: feedPosts,
    isLoading: feedLoading,
    isRefetching: feedRefetching,
    refetch: feedRefetch,
  } = useGetPosts(feedParams, {
    query: { enabled: !isSavedTab, queryKey: getGetPostsQueryKey(feedParams) },
  });

  const {
    data: savedPosts,
    isLoading: savedLoading,
    isRefetching: savedRefetching,
    refetch: savedRefetch,
  } = useGetSavedPosts({
    query: { enabled: isSavedTab, queryKey: getGetSavedPostsQueryKey() },
  });

  const { data: conditions } = useGetConditions();

  const posts = isSavedTab ? savedPosts : feedPosts;
  const isLoading = isSavedTab ? savedLoading : feedLoading;
  const isRefetching = isSavedTab ? savedRefetching : feedRefetching;
  const refetch = isSavedTab ? savedRefetch : feedRefetch;

  const reactPost = useReactToPost();
  const savePost = useSavePost();
  const unsavePost = useUnsavePost();
  const toggleRsvp = useToggleRsvp();
  const votePoll = useVotePoll();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
  };

  const handleReact = async (postId: number) => {
    await reactPost.mutateAsync({ postId, data: { reaction: "thumbsup" } });
    invalidate();
  };
  const handleSave = async (postId: number, saved: boolean) => {
    if (saved) await unsavePost.mutateAsync({ postId });
    else await savePost.mutateAsync({ postId });
    invalidate();
  };
  const handleRsvp = async (postId: number) => {
    await toggleRsvp.mutateAsync({ postId });
    invalidate();
  };
  const handleVote = async (postId: number, optionId: number) => {
    await votePoll.mutateAsync({ postId, data: { optionId } });
    invalidate();
  };

  const renderPost = ({ item }: { item: any }) => {
    const isLiked = item.myReaction === "thumbsup" || item.myReaction === "heart";
    const meta = POST_TYPE_META[item.postType];
    const commentCount = item.commentCount ?? item.comments?.length ?? 0;

    return (
      <Pressable onPress={() => router.push(`/post/${item.id}`)}>
        <SoftCard style={{ marginBottom: 16 }}>
          <View style={styles.cardHeader}>
            <Pressable
              onPress={() => router.push(`/user/${item.userId}`)}
              style={styles.authorRow}
            >
              <UserAvatar
                name={item.user?.displayName}
                username={item.user?.username}
                avatarUrl={item.user?.avatarUrl}
                size={42}
              />
              <View style={styles.authorInfo}>
                <Text style={[styles.authorName, { color: colors.foreground }]}>
                  {item.user?.displayName}
                </Text>
                <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                  @{item.user?.username} · {timeAgo(item.createdAt)}
                </Text>
              </View>
            </Pressable>
            {meta && (
              <View style={[styles.typeBadge, { backgroundColor: meta.color + "1A" }]}>
                <Ionicons name={meta.icon} size={12} color={meta.color} />
                <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>
            )}
          </View>

          {item.title ? (
            <Text style={[styles.title, { color: colors.foreground }]}>
              {item.title}
            </Text>
          ) : null}
          {item.content ? (
            <Text style={[styles.content, { color: colors.foreground }]}>
              {item.content}
            </Text>
          ) : null}
          {item.feeling ? (
            <Text style={[styles.feeling, { color: colors.mutedForeground }]}>
              {" "}
              — feeling {item.feeling}
            </Text>
          ) : null}

          {item.eventDate ? (
            <View style={[styles.eventRow, { backgroundColor: colors.primary + "12" }]}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.eventText, { color: colors.primary }]}>
                {formatDate(item.eventDate)}
              </Text>
            </View>
          ) : null}

          {item.imageUrl ? (
            <Image
              source={{ uri: resolveAssetUrl(item.imageUrl) }}
              style={styles.postImage}
              contentFit="cover"
              transition={150}
            />
          ) : null}

          {item.photos && item.photos.length > 0 ? (
            <FlatList
              horizontal
              data={item.photos}
              keyExtractor={(_p, i) => i.toString()}
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
              renderItem={({ item: photoUrl }) => (
                <Image
                  source={{ uri: resolveAssetUrl(photoUrl) }}
                  style={styles.carouselImage}
                  contentFit="cover"
                  transition={150}
                />
              )}
            />
          ) : null}

          {item.poll && item.poll.options ? (
            <View style={styles.poll}>
              {item.poll.options.map((opt: any) => {
                const pct =
                  item.poll.totalVotes > 0
                    ? Math.round((opt.voteCount / item.poll.totalVotes) * 100)
                    : 0;
                const mine = item.poll.myVote === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.pollOption,
                      {
                        borderColor: mine ? colors.primary : colors.border,
                        backgroundColor: colors.muted,
                      },
                    ]}
                    onPress={() => handleVote(item.id, opt.id)}
                  >
                    <View
                      style={[
                        styles.pollFill,
                        { width: `${pct}%`, backgroundColor: colors.primary + "26" },
                      ]}
                    />
                    <View style={styles.pollRow}>
                      <Text style={[styles.pollText, { color: colors.foreground }]}>
                        {mine ? "✓ " : ""}
                        {opt.text}
                      </Text>
                      <Text style={[styles.pollPct, { color: colors.foreground }]}>
                        {pct}%
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Text style={[styles.pollTotal, { color: colors.mutedForeground }]}>
                {item.poll.totalVotes} votes
              </Text>
            </View>
          ) : null}

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable style={styles.actionBtn} onPress={() => handleReact(item.id)}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={20}
                color={isLiked ? colors.destructive : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: isLiked ? colors.destructive : colors.mutedForeground },
                ]}
              >
                {item.likeCount || 0}
              </Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(`/post/${item.id}`)}
            >
              <Ionicons
                name="chatbubble-outline"
                size={19}
                color={colors.mutedForeground}
              />
              <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
                {commentCount}
              </Text>
            </Pressable>
            {(item.postType === "event" || item.postType === "tie_up") && (
              <Pressable style={styles.actionBtn} onPress={() => handleRsvp(item.id)}>
                <Ionicons
                  name={item.rsvpByMe ? "checkmark-circle" : "calendar-outline"}
                  size={19}
                  color={item.rsvpByMe ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: item.rsvpByMe ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {item.rsvpCount || 0}
                </Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.actionBtn}
              onPress={() => handleSave(item.id, !!item.savedByMe)}
            >
              <Ionicons
                name={item.savedByMe ? "bookmark" : "bookmark-outline"}
                size={19}
                color={item.savedByMe ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </SoftCard>
      </Pressable>
    );
  };

  const ListHeader = (
    <View>
      {conditions ? (
        <Pressable onPress={() => router.push("/conditions")}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.conditions}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.condLabel}>DALE HOLLOW LAKE</Text>
              <Text style={styles.condTemp}>
                {Math.round(conditions.temperature)}°
              </Text>
              <Text style={styles.condWeather}>{conditions.weatherLabel}</Text>
            </View>
            <View style={styles.condStats}>
              {conditions.waterTemperature != null && (
                <View style={styles.condStat}>
                  <Ionicons name="water" size={15} color="#fff" />
                  <Text style={styles.condStatText}>
                    {Math.round(conditions.waterTemperature)}° water
                  </Text>
                </View>
              )}
              {conditions.waterLevel != null && (
                <View style={styles.condStat}>
                  <Ionicons name="trending-up" size={15} color="#fff" />
                  <Text style={styles.condStatText}>
                    {Math.round(conditions.waterLevel)} ft
                  </Text>
                </View>
              )}
              <View style={styles.condStat}>
                <Ionicons name="navigate" size={15} color="#fff" />
                <Text style={styles.condStatText}>
                  {Math.round(conditions.windSpeed)} mph
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
      >
        {TABS.map((tab) => (
          <Chip
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            tone="muted"
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        showBrand
        gradient
        subtitle="Find your crew on the water"
        right={
          <>
            <Pressable
              onPress={() => router.push("/notifications")}
              style={styles.headerIcon}
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/create-post")}
              style={styles.headerIcon}
            >
              <Ionicons name="add-circle" size={26} color="#fff" />
            </Pressable>
          </>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl
              refreshing={!!isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="newspaper-outline"
                size={48}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No posts yet. Be the first to share.
              </Text>
            </View>
          }
          renderItem={renderPost}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15 },
  headerIcon: { padding: 4 },

  conditions: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  condLabel: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  condTemp: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 46 },
  condWeather: { color: "rgba(255,255,255,0.95)", fontFamily: fonts.sansMedium, fontSize: 14 },
  condStats: { gap: 8 },
  condStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  condStatText: { color: "#fff", fontFamily: fonts.sansSemibold, fontSize: 13 },

  tabsScroll: { gap: 8, paddingBottom: 16, paddingRight: 8 },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  authorRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  authorInfo: { marginLeft: 10, flex: 1 },
  authorName: { fontFamily: fonts.sansBold, fontSize: 15.5 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 13, marginTop: 1 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typeBadgeText: { fontFamily: fonts.sansBold, fontSize: 11 },

  title: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 5 },
  content: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  feeling: { fontFamily: fonts.sans, fontSize: 14, fontStyle: "italic", marginTop: 4 },

  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  eventText: { fontFamily: fonts.sansSemibold, fontSize: 14 },

  postImage: { width: "100%", height: 220, borderRadius: 14, marginTop: 12 },
  carouselImage: { width: 170, height: 170, borderRadius: 14, marginRight: 8 },

  poll: { marginTop: 12, gap: 8 },
  pollOption: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  pollRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pollText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  pollPct: { fontFamily: fonts.sansBold, fontSize: 14 },
  pollTotal: { fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 14,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
});
