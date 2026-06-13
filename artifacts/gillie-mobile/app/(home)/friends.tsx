import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import {
  useGetFriends,
  useGetFriendRequests,
  useGetFriendSuggestions,
  useAcceptFriendRequest,
  useFollowUser,
  useUnfollowUser,
  getGetFriendsQueryKey,
  getGetFriendRequestsQueryKey,
  getGetFriendSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useRouter } from "expo-router";
import UserAvatar from "@/components/UserAvatar";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SoftCard from "@/components/ui/SoftCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

export default function FriendsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: friends,
    isLoading: loadingFriends,
    refetch: refetchFriends,
    isRefetching: isRefetchingFriends,
  } = useGetFriends();
  const { data: requests, isLoading: loadingRequests, refetch: refetchRequests } = useGetFriendRequests();
  const { data: suggestions, isLoading: loadingSuggestions, refetch: refetchSuggestions } =
    useGetFriendSuggestions();

  const acceptRequest = useAcceptFriendRequest();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const refreshAll = () => {
    refetchFriends();
    refetchRequests();
    refetchSuggestions();
  };

  const handleAccept = (requestId: number) => {
    acceptRequest.mutate(
      { requestId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFriendRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
        },
      }
    );
  };

  const handleUnfollow = (userId: number) => {
    unfollowUser.mutate(
      { userId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() }) }
    );
  };

  const handleFollow = (userId: number) => {
    followUser.mutate(
      { userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFriendSuggestionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
        },
      }
    );
  };

  const loading = loadingFriends && loadingRequests && loadingSuggestions;
  const hasRequests = (requests?.length ?? 0) > 0;
  const hasSuggestions = (suggestions?.length ?? 0) > 0;
  const hasFriends = (friends?.length ?? 0) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Friends" subtitle="Friends, requests & people to meet" back />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingFriends}
              onRefresh={refreshAll}
              tintColor={colors.primary}
            />
          }
        >
          {hasRequests && (
            <View style={styles.section}>
              <SectionHeader title="Requests" icon="person-add" />
              {requests!.map((req) => {
                const user = req.follower;
                if (!user) return null;
                return (
                  <SoftCard key={req.id} style={styles.card} padded={false}>
                    <Pressable style={styles.row} onPress={() => router.push(`/user/${user.id}`)}>
                      <UserAvatar
                        name={user.displayName}
                        username={user.username}
                        avatarUrl={user.avatarUrl}
                        size={48}
                      />
                      <View style={styles.info}>
                        <Text style={[styles.name, { color: colors.foreground }]}>{user.displayName}</Text>
                        <Text style={[styles.username, { color: colors.mutedForeground }]}>
                          @{user.username}
                        </Text>
                      </View>
                      <Pressable
                        style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleAccept(req.id)}
                      >
                        <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                        <Text style={[styles.acceptText, { color: colors.primaryForeground }]}>Accept</Text>
                      </Pressable>
                    </Pressable>
                  </SoftCard>
                );
              })}
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader title="Friends" icon="people" />
            {hasFriends ? (
              friends!.map((user) => (
                <SoftCard key={user.id} style={styles.card} padded={false}>
                  <Pressable style={styles.row} onPress={() => router.push(`/user/${user.id}`)}>
                    <UserAvatar
                      name={user.displayName}
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      size={48}
                      online={user.isOnline}
                    />
                    <View style={styles.info}>
                      <Text style={[styles.name, { color: colors.foreground }]}>{user.displayName}</Text>
                      <Text style={[styles.username, { color: colors.mutedForeground }]}>
                        @{user.username}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.iconBtn, { backgroundColor: colors.muted }]}
                      onPress={() => handleUnfollow(user.id)}
                      hitSlop={6}
                    >
                      <Ionicons name="person-remove-outline" size={18} color={colors.foreground} />
                    </Pressable>
                  </Pressable>
                </SoftCard>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                You're not following anyone yet.
              </Text>
            )}
          </View>

          {hasSuggestions && (
            <View style={styles.section}>
              <SectionHeader title="Suggestions" icon="sparkles" />
              {suggestions!.map((user) => (
                <SoftCard key={user.id} style={styles.card} padded={false}>
                  <Pressable style={styles.row} onPress={() => router.push(`/user/${user.id}`)}>
                    <UserAvatar
                      name={user.displayName}
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      size={48}
                      online={user.isOnline}
                    />
                    <View style={styles.info}>
                      <Text style={[styles.name, { color: colors.foreground }]}>{user.displayName}</Text>
                      <Text style={[styles.username, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {user.reason || `@${user.username}`}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleFollow(user.id)}
                    >
                      <Ionicons name="person-add" size={15} color={colors.primaryForeground} />
                      <Text style={[styles.acceptText, { color: colors.primaryForeground }]}>Add</Text>
                    </Pressable>
                  </Pressable>
                </SoftCard>
              ))}
            </View>
          )}

          {!hasFriends && !hasRequests && !hasSuggestions && (
            <View style={styles.bigEmpty}>
              <Ionicons name="people-outline" size={56} color={colors.mutedForeground} />
              <Text style={[styles.bigEmptyText, { color: colors.mutedForeground }]}>
                No crew yet. Find people on the water to follow.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  section: { marginBottom: 24 },
  card: { marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", padding: 12 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontFamily: fonts.sansSemibold, fontSize: 16, marginBottom: 2 },
  username: { fontFamily: fonts.sans, fontSize: 13.5 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  acceptText: { fontFamily: fonts.sansBold, fontSize: 13 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, paddingVertical: 8 },
  bigEmpty: { alignItems: "center", paddingVertical: 60, gap: 12, paddingHorizontal: 32 },
  bigEmptyText: { fontFamily: fonts.sans, fontSize: 15, textAlign: "center" },
});
