import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useGetFriends, useGetFriendRequests, useSearchUsers, useFollowUser, useUnfollowUser, useAcceptFriendRequest, useGetFollowers, useGetMe, getGetFollowersQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import UserAvatar from "@/components/UserAvatar";
import { Ionicons } from "@expo/vector-icons";

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [tab, setTab] = useState<"following" | "followers" | "requests">("following");
  const { data: me } = useGetMe();
  
  const { data: friends, isLoading: loadingFriends, refetch: refetchFriends, isRefetching: isRefetchingFriends } = useGetFriends();
  const { data: followers, isLoading: loadingFollowers, refetch: refetchFollowers, isRefetching: isRefetchingFollowers } = useGetFollowers(me?.id ?? 0, { query: { enabled: !!me?.id, queryKey: getGetFollowersQueryKey(me?.id ?? 0) } });
  const { data: requests, isLoading: loadingRequests, refetch: refetchRequests, isRefetching: isRefetchingRequests } = useGetFriendRequests();

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const acceptRequest = useAcceptFriendRequest();

  const handleUnfollow = (id: number) => {
    unfollowUser.mutate({ userId: id }, { onSuccess: () => refetchFriends() });
  };

  const handleAccept = (id: number, _status: 'accepted' | 'rejected') => {
    acceptRequest.mutate({ requestId: id }, { onSuccess: () => refetchRequests() });
  };

  const renderTabs = () => (
    <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
      <Pressable style={[styles.tab, tab === "following" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setTab("following")}>
        <Text style={[styles.tabText, { color: tab === "following" ? colors.primary : colors.mutedForeground }]}>Following</Text>
      </Pressable>
      <Pressable style={[styles.tab, tab === "followers" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setTab("followers")}>
        <Text style={[styles.tabText, { color: tab === "followers" ? colors.primary : colors.mutedForeground }]}>Followers</Text>
      </Pressable>
      <Pressable style={[styles.tab, tab === "requests" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setTab("requests")}>
        <Text style={[styles.tabText, { color: tab === "requests" ? colors.primary : colors.mutedForeground }]}>Requests {requests && requests.length > 0 ? `(${requests.length})` : ''}</Text>
      </Pressable>
    </View>
  );

  const renderContent = () => {
    if (tab === "following") {
      if (loadingFriends) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
      return (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={isRefetchingFriends} onRefresh={refetchFriends} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 40, fontFamily: fonts.sans }}>Not following anyone yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/user/${item.id}`)}>
              <UserAvatar name={item.displayName} username={item.username} avatarUrl={item.avatarUrl} size={48} online={item.isOnline} />
              <View style={styles.cardInfo}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.displayName}</Text>
                <Text style={[styles.username, { color: colors.mutedForeground }]}>@{item.username}</Text>
              </View>
              <Pressable style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => handleUnfollow(item.id)}>
                <Ionicons name="person-remove" size={16} color={colors.foreground} />
              </Pressable>
            </Pressable>
          )}
        />
      );
    }

    if (tab === "followers") {
      if (loadingFollowers) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
      return (
        <FlatList
          data={followers}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={isRefetchingFollowers} onRefresh={refetchFollowers} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 40, fontFamily: fonts.sans }}>No followers yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/user/${item.id}`)}>
              <UserAvatar name={item.displayName} username={item.username} avatarUrl={item.avatarUrl} size={48} online={item.isOnline} />
              <View style={styles.cardInfo}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.displayName}</Text>
                <Text style={[styles.username, { color: colors.mutedForeground }]}>@{item.username}</Text>
              </View>
            </Pressable>
          )}
        />
      );
    }

    if (tab === "requests") {
      if (loadingRequests) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
      return (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={isRefetchingRequests} onRefresh={refetchRequests} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 40, fontFamily: fonts.sans }}>No pending requests.</Text>}
          renderItem={({ item }) => {
            const user = item.follower;
            if (!user) return null;
            return (
              <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/user/${user.id}`)}>
                <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} size={48} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{user.displayName}</Text>
                  <Text style={[styles.username, { color: colors.mutedForeground }]}>@{user.username}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleAccept(item.id, 'accepted')}>
                    <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      );
    }
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Friends</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {renderTabs()}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  card: { padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  name: { fontFamily: fonts.sansSemibold, fontSize: 16, marginBottom: 2 },
  username: { fontFamily: fonts.sans, fontSize: 14 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }
});
