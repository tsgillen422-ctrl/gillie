import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, ScrollView } from "react-native";
import { useGetPosts, useGetSavedPosts, useReactToPost, useSavePost, useUnsavePost, useToggleRsvp, useVotePoll, getGetPostsQueryKey, getGetSavedPostsQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import UserAvatar from "@/components/UserAvatar";
import { timeAgo, resolveAssetUrl } from "@/lib/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";

const TABS = [
  { id: "all", label: "All" },
  { id: "friends", label: "Friends" },
  { id: "community", label: "Community" },
  { id: "event", label: "Events" },
  { id: "business", label: "Business" },
  { id: "saved", label: "Saved" },
];

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const isSavedTab = activeTab === "saved";
  const isTrendingTab = activeTab === "trending";
  
  let feedParams: any = {};
  if (activeTab === "friends") feedParams = { audience: "friends" };
  else if (activeTab === "community") feedParams = { audience: "community" };
  else if (activeTab === "event" || activeTab === "business") feedParams = { type: activeTab };

  const { data: feedPosts, isLoading: feedLoading, isRefetching: feedRefetching, refetch: feedRefetch } = useGetPosts(feedParams, {
    query: { enabled: !isSavedTab && !isTrendingTab, queryKey: getGetPostsQueryKey(feedParams) },
  });
  
  const { data: savedPosts, isLoading: savedLoading, isRefetching: savedRefetching, refetch: savedRefetch } = useGetSavedPosts({
    query: { enabled: isSavedTab, queryKey: getGetSavedPostsQueryKey() },
  });
  
  const posts = isSavedTab ? savedPosts : feedPosts; // Trending not implemented in api client for mobile yet, fallback to all for now or empty
  const isLoading = isSavedTab ? savedLoading : feedLoading;
  const isRefetching = isSavedTab ? savedRefetching : feedRefetching;
  const refetch = isSavedTab ? savedRefetch : feedRefetch;

  const reactPost = useReactToPost();
  const savePost = useSavePost();
  const unsavePost = useUnsavePost();
  const toggleRsvp = useToggleRsvp();
  const votePoll = useVotePoll();

  const handleReact = async (postId: number, reaction: "thumbsup" | "heart" = "thumbsup") => {
    await reactPost.mutateAsync({ postId, data: { reaction } });
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
  };

  const handleSave = async (postId: number, saved: boolean) => {
    if (saved) {
      await unsavePost.mutateAsync({ postId });
    } else {
      await savePost.mutateAsync({ postId });
    }
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
  };

  const handleRsvp = async (postId: number) => {
    await toggleRsvp.mutateAsync({ postId });
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
  };

  const handleVote = async (postId: number, optionId: number) => {
    await votePoll.mutateAsync({ postId, data: { optionId } });
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
  };

  const renderPost = ({ item }: { item: any }) => {
    const isLiked = item.myReaction === "thumbsup" || item.myReaction === "heart"; // simplify for now
    
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/post/${item.id}`)}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.push(`/user/${item.userId}`)} style={styles.authorRow}>
            <UserAvatar 
              name={item.user?.displayName} 
              username={item.user?.username} 
              avatarUrl={item.user?.avatarUrl} 
              size={40} 
            />
            <View style={styles.authorInfo}>
              <Text style={[styles.authorName, { color: colors.foreground }]}>{item.user?.displayName}</Text>
              <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                @{item.user?.username} • {timeAgo(item.createdAt)}
              </Text>
            </View>
          </Pressable>
          <View style={[styles.badge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.postType}</Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[styles.content, { color: colors.foreground }]}>{item.content}</Text>
        
        {item.feeling && (
          <Text style={[styles.feeling, { color: colors.mutedForeground }]}>
            is feeling {item.feeling}
          </Text>
        )}

        {item.imageUrl && (
          <Image 
            source={{ uri: resolveAssetUrl(item.imageUrl) }} 
            style={styles.postImage} 
            contentFit="cover" 
          />
        )}

        {item.photos && item.photos.length > 0 && (
          <FlatList
            horizontal
            data={item.photos}
            keyExtractor={(p, i) => i.toString()}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: photoUrl }) => (
              <Image 
                source={{ uri: resolveAssetUrl(photoUrl) }} 
                style={styles.carouselImage} 
                contentFit="cover" 
              />
            )}
          />
        )}

        {item.poll && item.poll.options && (
          <View style={styles.pollContainer}>
            {item.poll.options.map((opt: any) => {
              const pct = item.poll.totalVotes > 0 ? Math.round((opt.voteCount / item.poll.totalVotes) * 100) : 0;
              const mine = item.poll.myVote === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.pollOption, { borderColor: colors.border, backgroundColor: mine ? colors.primary + '20' : 'transparent' }]}
                  onPress={() => handleVote(item.id, opt.id)}
                >
                  <View style={[styles.pollFill, { width: `${pct}%`, backgroundColor: colors.muted }]} />
                  <View style={styles.pollRow}>
                    <Text style={[styles.pollText, { color: colors.foreground }]}>{opt.text}</Text>
                    <Text style={[styles.pollPct, { color: colors.mutedForeground }]}>{pct}%</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={[styles.pollTotal, { color: colors.mutedForeground }]}>
              {item.poll.totalVotes} votes
            </Text>
          </View>
        )}

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable style={styles.actionBtn} onPress={() => handleReact(item.id)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? colors.destructive : colors.mutedForeground} />
            <Text style={[styles.actionText, { color: isLiked ? colors.destructive : colors.mutedForeground }]}>
              {item.likeCount || 0}
            </Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/post/${item.id}`)}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
              {item.commentCount || 0}
            </Text>
          </Pressable>
          
          {(item.postType === "event" || item.postType === "tie_up") && (
            <Pressable style={styles.actionBtn} onPress={() => handleRsvp(item.id)}>
              <Ionicons name={item.rsvpByMe ? "calendar" : "calendar-outline"} size={20} color={item.rsvpByMe ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.actionText, { color: item.rsvpByMe ? colors.primary : colors.mutedForeground }]}>
                {item.rsvpCount || 0} RSVP
              </Text>
            </Pressable>
          )}

          <Pressable style={styles.actionBtn} onPress={() => handleSave(item.id, !!item.savedByMe)}>
            <Ionicons name={item.savedByMe ? "bookmark" : "bookmark-outline"} size={20} color={item.savedByMe ? colors.primary : colors.mutedForeground} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.headerArea}>
        <Text style={[styles.mainTitle, { color: colors.foreground }]}>Feed</Text>
        <Pressable onPress={() => router.push("/create-post")} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>
      
      <View style={{ height: 50 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map(tab => (
            <Pressable
              key={tab.id}
              style={[
                styles.tabBtn,
                { 
                  backgroundColor: activeTab === tab.id ? colors.primary : colors.card,
                  borderColor: colors.border
                }
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[
                styles.tabText, 
                { color: activeTab === tab.id ? colors.primaryForeground : colors.foreground }
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={refetch} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="newspaper-outline" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>No posts found</Text>
            </View>
          }
          renderItem={renderPost}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 200 },
  headerArea: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  mainTitle: { fontFamily: fonts.displayBold, fontSize: 28 },
  createBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tabsScroll: { paddingHorizontal: 16, alignItems: "center", gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  card: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  authorRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  authorInfo: { marginLeft: 10, flex: 1 },
  authorName: { fontFamily: fonts.sansBold, fontSize: 16 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 11, textTransform: "capitalize" },
  title: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 6 },
  content: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  feeling: { fontFamily: fonts.sans, fontSize: 14, fontStyle: "italic", marginBottom: 12 },
  postImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  carouselImage: { width: 160, height: 160, borderRadius: 12, marginRight: 8, marginBottom: 12 },
  pollContainer: { marginTop: 8, marginBottom: 12 },
  pollOption: { position: "relative", overflow: "hidden", borderRadius: 8, borderWidth: 1, marginBottom: 8, padding: 12 },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.3 },
  pollRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pollText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  pollPct: { fontFamily: fonts.sansBold, fontSize: 14 },
  pollTotal: { fontFamily: fonts.sans, fontSize: 12, marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 4 },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 14, marginLeft: 6 },
});
