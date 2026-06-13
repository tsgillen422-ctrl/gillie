import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  useGetMe,
  useUpdateMe,
  useGetBlockedUsers,
  useUnblockUser,
  useDeleteCurrentUser,
  useRequestUploadUrl,
  getGetMeQueryKey,
  getGetBlockedUsersQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

import { UserAvatar } from "@/components/UserAvatar";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SoftCard from "@/components/ui/SoftCard";
import SectionHeader from "@/components/ui/SectionHeader";
import Chip from "@/components/ui/Chip";

type IoniconName = keyof typeof Ionicons.glyphMap;

function prettify(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();

  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const requestUploadUrl = useRequestUploadUrl();
  const { data: blocked } = useGetBlockedUsers();
  const unblockUser = useUnblockUser();
  const deleteUser = useDeleteCurrentUser();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [hometown, setHometown] = useState("");
  const [work, setWork] = useState("");
  const [boatName, setBoatName] = useState("");
  const [boatType, setBoatType] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [shareLocation, setShareLocation] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setBio(me.bio || "");
      setLocation(me.location || "");
      setHometown(me.hometown || "");
      setWork(me.work || "");
      setBoatName(me.boatName || "");
      setBoatType(me.boatType || "");
      setInterests(me.interests || []);
      setAvatarUrl(me.avatarUrl ?? undefined);
      setShareLocation(me.shareLocation ?? true);
    }
  }, [me]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to change your avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    try {
      setUploading(true);
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      const contentType = asset.mimeType || blob.type || "image/jpeg";
      const name = asset.fileName || `avatar-${Date.now()}.jpg`;
      const upload = await requestUploadUrl.mutateAsync({
        data: { name, size: blob.size || asset.fileSize || 1, contentType },
      });
      await fetch(upload.uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
      });
      setAvatarUrl(upload.objectPath);
    } catch (e) {
      console.error(e);
      Alert.alert("Upload failed", "Could not upload your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const addInterest = () => {
    const v = newInterest.trim();
    if (!v) return;
    if (interests.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setNewInterest("");
      return;
    }
    setInterests([...interests, v]);
    setNewInterest("");
  };

  const removeInterest = (val: string) => {
    setInterests(interests.filter((i) => i !== val));
  };

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync({
        data: {
          displayName,
          bio,
          location,
          hometown,
          work,
          boatName,
          boatType,
          interests,
          shareLocation,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save your changes.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleDelete = () => {
    if (!me) return;
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteUser.mutate(undefined, {
              onSuccess: async () => {
                await signOut();
                router.replace("/");
              },
              onError: () =>
                Alert.alert("Error", "Could not delete your account."),
            });
          },
        },
      ],
    );
  };

  const handleUnblock = (userId: number) => {
    unblockUser.mutate(
      { userId },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: getGetBlockedUsersQueryKey(),
          }),
      },
    );
  };

  if (isLoading || !me) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const textFields: {
    label: string;
    value: string;
    setter: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
  }[] = [
    { label: "Display Name", value: displayName, setter: setDisplayName, placeholder: "Your name" },
    { label: "Bio", value: bio, setter: setBio, multiline: true, placeholder: "Tell the lake about you" },
    { label: "Location", value: location, setter: setLocation, placeholder: "Dale Hollow Lake" },
    { label: "Hometown", value: hometown, setter: setHometown, placeholder: "Where you're from" },
    { label: "Work", value: work, setter: setWork, placeholder: "What you do" },
    { label: "Boat Name", value: boatName, setter: setBoatName, placeholder: "Your vessel" },
    { label: "Boat Type", value: boatType, setter: setBoatType, placeholder: "Pontoon, bass boat..." },
  ];

  const navRows: { icon: IoniconName; label: string; onPress: () => void }[] = [
    { icon: "people-outline", label: "Friends", onPress: () => router.push("/friends") },
    { icon: "notifications-outline", label: "Notifications", onPress: () => router.push("/notifications") },
    { icon: "partly-sunny-outline", label: "Lake Conditions", onPress: () => router.push("/conditions") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Settings"
        back
        right={
          <Pressable
            onPress={handleSave}
            disabled={updateMe.isPending}
            style={styles.headerBtn}
            hitSlop={8}
          >
            {updateMe.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            )}
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Edit Profile */}
        <SectionHeader title="Edit Profile" icon="person-circle-outline" />
        <SoftCard>
          <View style={styles.avatarBlock}>
            <Pressable onPress={pickAvatar} style={styles.avatarPress}>
              <UserAvatar
                name={displayName || me.displayName}
                username={me.username}
                avatarUrl={avatarUrl}
                size={88}
              />
              <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.primaryForeground} />
                )}
              </View>
            </Pressable>
            <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
              Tap to change photo
            </Text>
          </View>

          {textFields.map((f, i) => (
            <View key={f.label} style={i > 0 ? { marginTop: 16 } : undefined}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>{f.label}</Text>
              <TextInput
                style={[
                  styles.input,
                  f.multiline && styles.inputMultiline,
                  { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
                ]}
                value={f.value}
                onChangeText={f.setter}
                placeholder={f.placeholder}
                placeholderTextColor={colors.mutedForeground}
                multiline={f.multiline}
                textAlignVertical={f.multiline ? "top" : "center"}
              />
            </View>
          ))}
        </SoftCard>

        {/* Interests */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Interests" icon="sparkles-outline" />
          <SoftCard>
            {interests.length > 0 ? (
              <View style={styles.chipWrap}>
                {interests.map((it) => (
                  <Pressable key={it} onPress={() => removeInterest(it)}>
                    <View style={[styles.interestChip, { backgroundColor: colors.primary + "1A" }]}>
                      <Text style={[styles.interestText, { color: colors.primary }]}>
                        {prettify(it)}
                      </Text>
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Add what you love about lake life.
              </Text>
            )}
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
                ]}
                value={newInterest}
                onChangeText={setNewInterest}
                placeholder="Add an interest"
                placeholderTextColor={colors.mutedForeground}
                onSubmitEditing={addInterest}
                returnKeyType="done"
              />
              <Pressable
                onPress={addInterest}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add" size={22} color={colors.primaryForeground} />
              </Pressable>
            </View>
          </SoftCard>
        </View>

        {/* Preferences */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Preferences" icon="options-outline" />
          <SoftCard>
            <View style={styles.prefRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Share Location</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  Allow others to see you on the map
                </Text>
              </View>
              <Switch
                value={shareLocation}
                onValueChange={setShareLocation}
                trackColor={{ false: colors.muted, true: colors.primary }}
              />
            </View>
          </SoftCard>
        </View>

        {/* Navigation */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Explore" icon="compass-outline" />
          <SoftCard padded={false}>
            {navRows.map((row, i) => (
              <Pressable
                key={row.label}
                onPress={row.onPress}
                style={[
                  styles.listRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <Ionicons name={row.icon} size={20} color={colors.primary} style={{ width: 28 }} />
                <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>{row.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowBlocked((s) => !s)}
              style={[
                styles.listRow,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <Ionicons name="ban-outline" size={20} color={colors.primary} style={{ width: 28 }} />
              <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>
                Blocked Users{blocked && blocked.length > 0 ? ` (${blocked.length})` : ""}
              </Text>
              <Ionicons
                name={showBlocked ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            {showBlocked && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                {!blocked || blocked.length === 0 ? (
                  <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                    You haven't blocked anyone.
                  </Text>
                ) : (
                  blocked.map((u) => (
                    <View key={u.id} style={styles.blockedRow}>
                      <UserAvatar
                        name={u.displayName}
                        username={u.username}
                        avatarUrl={u.avatarUrl}
                        size={36}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.rowLabel, { color: colors.foreground }]} numberOfLines={1}>
                          {u.displayName}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                          @{u.username}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleUnblock(u.id)}
                        style={[styles.unblockBtn, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </SoftCard>
        </View>

        {/* Account */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Account" icon="shield-outline" />
          <SoftCard padded={false}>
            <Pressable onPress={handleSignOut} style={styles.listRow}>
              <Ionicons name="log-out-outline" size={20} color={colors.foreground} style={{ width: 28 }} />
              <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>Sign Out</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={deleteUser.isPending}
              style={[
                styles.listRow,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <Ionicons name="trash-outline" size={20} color={colors.destructive} style={{ width: 28 }} />
              <Text style={[styles.rowLabel, { color: colors.destructive, flex: 1 }]}>Delete Account</Text>
              {deleteUser.isPending ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.destructive} />
              )}
            </Pressable>
          </SoftCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerBtn: { minWidth: 44, height: 40, justifyContent: "center", alignItems: "center" },
  saveText: { fontFamily: fonts.sansBold, fontSize: 16 },

  avatarBlock: { alignItems: "center", marginBottom: 20 },
  avatarPress: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarHint: { fontFamily: fonts.sans, fontSize: 13, marginTop: 8 },

  label: { fontFamily: fonts.sansSemibold, fontSize: 13, marginBottom: 6 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputMultiline: { height: 90, paddingTop: 11 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  interestText: { fontFamily: fonts.sansSemibold, fontSize: 13 },
  emptyHint: { fontFamily: fonts.sans, fontSize: 14, marginBottom: 12 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  prefRow: { flexDirection: "row", alignItems: "center" },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15 },
  rowLabel: { fontFamily: fonts.sansSemibold, fontSize: 15.5 },
  rowSub: { fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },

  blockedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  unblockText: { fontFamily: fonts.sansSemibold, fontSize: 13 },
});
