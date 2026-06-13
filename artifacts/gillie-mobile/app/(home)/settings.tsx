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
import { SvgXml } from "react-native-svg";
import {
  useGetMe,
  useUpdateMe,
  useGetBlockedUsers,
  useUnblockUser,
  useDeleteCurrentUser,
  useRequestUploadUrl,
  getGetMeQueryKey,
  getGetBlockedUsersQueryKey,
  type UserUpdate,
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

type IoniconName = keyof typeof Ionicons.glyphMap;

function prettify(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEFAULT_BOAT_COLOR = "#0ea5e9";

const BOAT_COLORS = [
  "#0ea5e9", "#0284c7", "#1d4ed8", "#6366f1", "#06b6d4",
  "#14b8a6", "#10b981", "#22c55e", "#84cc16", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#d946ef",
  "#8b5cf6", "#334155", "#0f172a", "#78716c", "#f8fafc",
];

const BOAT_TYPES: { value: string; label: string; desc: string }[] = [
  { value: "speedboat", label: "Speed Boat", desc: "Sleek & fast" },
  { value: "fishing", label: "Fishing Boat", desc: "Reel them in" },
  { value: "pontoon", label: "Pontoon", desc: "Relaxed cruiser" },
  { value: "sailboat", label: "Sailboat", desc: "Wind powered" },
  { value: "kayak", label: "Kayak", desc: "Paddle solo" },
  { value: "jetski", label: "Jet Ski", desc: "Quick & nimble" },
  { value: "yacht", label: "Yacht", desc: "Luxury cruiser" },
];

// Boat artwork mirrored from the web app (artifacts/dhl-app/src/boats.ts). Each
// hull uses currentColor, which SvgXml fills via the `color` prop, so the user's
// chosen boat color flows through without injecting user data into the markup.
const INK = "#27323a";
const shadeDefs = (id: string) => `<defs>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.4" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.36"/>
    </linearGradient>
    <linearGradient id="${id}-gl" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#e2f8ff"/>
      <stop offset="0.55" stop-color="#8ad6ef"/>
      <stop offset="1" stop-color="#46b7e0"/>
    </linearGradient>
  </defs>`;

const SB_HULL =
  "M5 22 H47 C54 22 60 25 62 28.5 C62.6 29.7 61.8 31 60.2 31.6 L52 35 C50.5 35.6 49 36 47 36 H15 C12.5 36 10.8 35.2 9.3 33.6 L4.5 28.5 C3.2 27.1 3.3 23.4 5 22 Z";
const SPEEDBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("sb")}
  <ellipse cx="32" cy="37.8" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="${SB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${SB_HULL}" fill="url(#sb-g)"/>
  <path d="${SB_HULL}" fill="url(#sb-s)"/>
  <rect x="10" y="23.6" width="34" height="3.2" rx="1.6" fill="#ffffff" opacity="0.92"/>
  <path d="M9 32 C12 33.8 16 34.6 20 34.6 H44 C47 34.6 49.5 34 52 32.8 L53.6 32 C49 32.6 12 32.6 9 32 Z" fill="#001a2b" opacity="0.32"/>
  <path d="M34 13.5 C36.5 13.5 38.5 14.5 40 16.2 L45 22 H31 V16.5 C31 14.7 32 13.5 34 13.5 Z" fill="url(#sb-gl)" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M33.6 15.4 L37.6 19.6 H34 Z" fill="#ffffff" opacity="0.85"/>
</svg>`;

const PONTOON_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("pn")}
  <ellipse cx="32" cy="38.6" rx="26" ry="2.8" fill="#0b2f4a" opacity="0.22"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="currentColor" stroke="${INK}" stroke-width="2.4"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="url(#pn-g)"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="url(#pn-s)"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="currentColor" stroke="${INK}" stroke-width="2.4"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="url(#pn-g)"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="url(#pn-s)"/>
  <rect x="9" y="22.8" width="46" height="2.6" rx="1.3" fill="#ffffff" opacity="0.88"/>
  <rect x="13" y="6.5" width="38" height="5.5" rx="2.7" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
  <rect x="13" y="6.5" width="38" height="5.5" rx="2.7" fill="url(#pn-s)" opacity="0.45"/>
  <rect x="15.2" y="11.5" width="2.6" height="10.5" rx="1.3" fill="${INK}"/>
  <rect x="46.2" y="11.5" width="2.6" height="10.5" rx="1.3" fill="${INK}"/>
</svg>`;

const SL_HULL =
  "M10 27 H54 L48 34 C46.7 35.6 45 36 43 36 H21 C19 36 17.3 35.4 16 34 Z";
const SAILBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("sl")}
  <ellipse cx="32" cy="37.5" rx="24" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <rect x="31" y="4.5" width="2.6" height="23.5" rx="1.3" fill="${INK}"/>
  <path d="M35 6 C44.5 11 47.5 18 47.5 25 L35 25 Z" fill="#ffffff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M35 6 C44.5 11 47.5 18 47.5 25 L35 25 Z" fill="url(#sl-s)" opacity="0.4"/>
  <path d="M29 9 L29 25 L18 25 C21 18.5 25 13 29 9 Z" fill="#ffffff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M29 9 L29 25 L18 25 C21 18.5 25 13 29 9 Z" fill="url(#sl-s)" opacity="0.32"/>
  <path d="${SL_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${SL_HULL}" fill="url(#sl-g)"/>
  <path d="${SL_HULL}" fill="url(#sl-s)"/>
  <rect x="13" y="27.4" width="38" height="2.6" rx="1.3" fill="#ffffff" opacity="0.9"/>
  <path d="M16 33 H48 C46.7 34.6 45 35 43 35 H21 C19 35 17.3 34.6 16 33 Z" fill="#001a2b" opacity="0.28"/>
</svg>`;

const KY_HULL = "M4 26 C14 21 50 21 60 26 C50 31 14 31 4 26 Z";
const KAYAK_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("ky")}
  <ellipse cx="32" cy="33.5" rx="27" ry="2.6" fill="#0b2f4a" opacity="0.22"/>
  <path d="${KY_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${KY_HULL}" fill="url(#ky-g)"/>
  <path d="${KY_HULL}" fill="url(#ky-s)"/>
  <ellipse cx="32" cy="25" rx="6.5" ry="2.3" fill="#001a2b" opacity="0.5"/>
  <path d="M8 27.4 C18 29.4 46 29.4 56 27.4 C46 29 18 29 8 27.4 Z" fill="#001a2b" opacity="0.26"/>
  <rect x="18" y="12.6" width="28" height="2.8" rx="1.4" fill="#b07636" stroke="${INK}" stroke-width="1.3"/>
  <rect x="18" y="12.6" width="28" height="1.2" rx="0.6" fill="#ffffff" opacity="0.4"/>
</svg>`;

const JS_HULL =
  "M7 27 C12 22 24 20 34 20 C48 20 56 23 59 27 C57 32 50 34 38 34 H18 C12 34 8 31 7 27 Z";
const JETSKI_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("js")}
  <ellipse cx="32" cy="35.5" rx="24" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="${JS_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${JS_HULL}" fill="url(#js-g)"/>
  <path d="${JS_HULL}" fill="url(#js-s)"/>
  <rect x="11" y="24.8" width="40" height="2.8" rx="1.4" fill="#ffffff" opacity="0.9"/>
  <path d="M10 30 C16 32.6 48 32.6 54 30 C46 32 18 32 10 30 Z" fill="#001a2b" opacity="0.26"/>
  <path d="M26 19.5 C29 15.5 36 15.5 39 18.5 L39 22 H26 Z" fill="${INK}"/>
  <rect x="15" y="14.2" width="12" height="2.6" rx="1.3" fill="${INK}"/>
  <rect x="24" y="15.4" width="2.6" height="5" rx="1.3" fill="${INK}"/>
</svg>`;

const YC_HULL =
  "M5 26 H59 L52 34 C50.6 35.5 49 36 46 36 H18 C15 36 13.4 35.4 12 34 L5 26 Z";
const YACHT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("yc")}
  <ellipse cx="32" cy="37.5" rx="27" ry="3.2" fill="#0b2f4a" opacity="0.22"/>
  <rect x="20" y="9.5" width="18" height="7.5" rx="2" fill="currentColor" stroke="${INK}" stroke-width="2"/>
  <rect x="20" y="9.5" width="18" height="7.5" rx="2" fill="url(#yc-g)"/>
  <rect x="20" y="9.5" width="18" height="7.5" rx="2" fill="url(#yc-s)"/>
  <rect x="13" y="16.5" width="34" height="9.5" rx="2.4" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
  <rect x="13" y="16.5" width="34" height="9.5" rx="2.4" fill="url(#yc-s)" opacity="0.4"/>
  <circle cx="18.6" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <circle cx="25.2" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <circle cx="34.8" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <circle cx="41.4" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <path d="${YC_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${YC_HULL}" fill="url(#yc-g)"/>
  <path d="${YC_HULL}" fill="url(#yc-s)"/>
  <rect x="10" y="26.6" width="44" height="2.8" rx="1.4" fill="#ffffff" opacity="0.9"/>
  <path d="M12 32.6 H52 C50.6 34 49 34.5 46 34.5 H18 C15 34.5 13.4 34 12 32.6 Z" fill="#001a2b" opacity="0.28"/>
</svg>`;

const FB_HULL =
  "M5 24 H49 C55 24 60 26.5 62 29.5 C62.7 30.6 61.9 31.9 60.4 32.5 L52 36 C50.5 36.6 49 37 47 37 H14 C11.5 37 9.8 36.2 8.3 34.6 L4 29.5 C2.8 28.1 3.2 25.3 5 24 Z";
const FISHINGBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("fb")}
  <ellipse cx="32" cy="38.4" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="M44 24 L40 9" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M40 9 C46 11 49 15 50.5 20" stroke="#001a2b" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>
  <path d="M47 24 L52 10" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M52 10 C57 12.5 59.5 16.5 60.5 21" stroke="#001a2b" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>
  <path d="${FB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${FB_HULL}" fill="url(#fb-g)"/>
  <path d="${FB_HULL}" fill="url(#fb-s)"/>
  <rect x="10" y="25.6" width="34" height="3" rx="1.5" fill="#ffffff" opacity="0.9"/>
  <path d="M9 33 C12 34.8 16 35.6 20 35.6 H44 C47 35.6 49.5 35 52 33.8 L53.6 33 C49 33.6 12 33.6 9 33 Z" fill="#001a2b" opacity="0.3"/>
  <rect x="24" y="16" width="13" height="9" rx="2" fill="currentColor" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="24" y="16" width="13" height="9" rx="2" fill="url(#fb-g)"/>
  <rect x="24" y="16" width="13" height="9" rx="2" fill="url(#fb-s)"/>
  <path d="M25 16 C25 13.6 27 12 29.5 12 H33 L36.5 16 Z" fill="url(#fb-gl)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M27 15.4 L29.6 12.6 H31.4 L28.8 15.4 Z" fill="#ffffff" opacity="0.75"/>
</svg>`;

const BOAT_SVGS: Record<string, string> = {
  speedboat: SPEEDBOAT_SVG,
  fishing: FISHINGBOAT_SVG,
  pontoon: PONTOON_SVG,
  sailboat: SAILBOAT_SVG,
  kayak: KAYAK_SVG,
  jetski: JETSKI_SVG,
  yacht: YACHT_SVG,
};

function boatSvgFor(type?: string | null): string {
  return (type && BOAT_SVGS[type]) || SPEEDBOAT_SVG;
}

const FLAG_SVG = `<svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.2" y="0" width="2.4" height="24" rx="1.2" fill="${INK}"/>
  <path d="M4.6 1.5 H16.5 L12.8 5 L16.5 8.5 H4.6 Z" fill="currentColor" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M4.6 2.4 H14 L12 4.2 H4.6 Z" fill="#ffffff" opacity="0.3"/>
</svg>`;

function BoatPreview({
  type,
  color,
  neon,
  flag,
  accent,
  size = 1,
}: {
  type: string;
  color: string;
  neon?: boolean;
  flag?: boolean;
  accent?: string;
  size?: number;
}) {
  const accentColor = accent || color;
  const w = 84 * size;
  const h = 56 * size;
  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center" }}>
      {neon && (
        <View
          style={{
            position: "absolute",
            width: 56 * size,
            height: 16 * size,
            bottom: 8 * size,
            borderRadius: 999,
            backgroundColor: accentColor,
            opacity: 0.7,
            shadowColor: accentColor,
            shadowOpacity: 0.9,
            shadowRadius: 10 * size,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          }}
        />
      )}
      <SvgXml xml={boatSvgFor(type)} color={color} width={58 * size} height={38 * size} />
      {flag && (
        <View style={{ position: "absolute", left: 10 * size, top: 0 }}>
          <SvgXml xml={FLAG_SVG} color={accentColor} width={20 * size} height={24 * size} />
        </View>
      )}
    </View>
  );
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
  const [boatType, setBoatType] = useState("speedboat");
  const [boatColor, setBoatColor] = useState(DEFAULT_BOAT_COLOR);
  const [boatNeon, setBoatNeon] = useState(false);
  const [boatFlag, setBoatFlag] = useState(false);
  const [boatAccent, setBoatAccent] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // Privacy toggles (mirrors web settings)
  const [shareLocation, setShareLocation] = useState(true);
  const [requireFollowApproval, setRequireFollowApproval] = useState(false);
  const [showFollowers, setShowFollowers] = useState(true);
  const [showFriends, setShowFriends] = useState(true);
  const [followerSeeLocation, setFollowerSeeLocation] = useState(true);
  const [followerSeePosts, setFollowerSeePosts] = useState(true);
  const [followerSendMessages, setFollowerSendMessages] = useState(true);

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
      setBoatType(me.boatType || "speedboat");
      setBoatColor(me.boatColor || DEFAULT_BOAT_COLOR);
      setBoatNeon(me.boatNeon ?? false);
      setBoatFlag(me.boatFlag ?? false);
      setBoatAccent(me.boatAccent || "");
      setInterests(me.interests || []);
      setAvatarUrl(me.avatarUrl ?? undefined);
      setShareLocation(me.shareLocation ?? true);
      setRequireFollowApproval(me.requireFollowApproval ?? false);
      setShowFollowers(me.showFollowers ?? true);
      setShowFriends(me.showFriends ?? true);
      setFollowerSeeLocation(me.followerSeeLocation ?? true);
      setFollowerSeePosts(me.followerSeePosts ?? true);
      setFollowerSendMessages(me.followerSendMessages ?? true);
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
          boatColor,
          boatNeon,
          boatFlag,
          boatAccent: boatAccent || null,
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

  // Immediate privacy toggle with optimistic update + revert on error.
  const togglePrivacy = (
    key: keyof UserUpdate,
    value: boolean,
    setter: (v: boolean) => void,
  ) => {
    setter(value);
    updateMe.mutate(
      { data: { [key]: value } as UserUpdate },
      {
        onError: () => {
          setter(!value);
          Alert.alert("Error", "Failed to update setting.");
        },
      },
    );
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
  ];

  const navRows: { icon: IoniconName; label: string; onPress: () => void }[] = [
    { icon: "people-outline", label: "Friends", onPress: () => router.push("/friends") },
    { icon: "notifications-outline", label: "Notifications", onPress: () => router.push("/notifications") },
    { icon: "partly-sunny-outline", label: "Lake Conditions", onPress: () => router.push("/conditions") },
  ];

  const privacyRows: {
    icon: IoniconName;
    title: string;
    sub: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    {
      icon: "map-outline",
      title: "Location Sharing",
      sub: "Show your boat on the map to friends",
      value: shareLocation,
      onChange: (v) => togglePrivacy("shareLocation", v, setShareLocation),
    },
    {
      icon: "lock-closed-outline",
      title: "Approve New Followers",
      sub: "Require approval before someone can follow you",
      value: requireFollowApproval,
      onChange: (v) => togglePrivacy("requireFollowApproval", v, setRequireFollowApproval),
    },
    {
      icon: "people-outline",
      title: "Show Followers & Following",
      sub: "Let others see who follows you and who you follow",
      value: showFollowers,
      onChange: (v) => togglePrivacy("showFollowers", v, setShowFollowers),
    },
    {
      icon: "list-outline",
      title: "Show Friends List",
      sub: "Let others see your friends on your profile",
      value: showFriends,
      onChange: (v) => togglePrivacy("showFriends", v, setShowFriends),
    },
  ];

  const followerRows: {
    icon: IoniconName;
    title: string;
    sub: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    {
      icon: "map-outline",
      title: "See My Location",
      sub: "Show your boat on the map to followers you don't follow back",
      value: followerSeeLocation,
      onChange: (v) => togglePrivacy("followerSeeLocation", v, setFollowerSeeLocation),
    },
    {
      icon: "document-text-outline",
      title: "See My Posts",
      sub: "Let them see your friends-only posts",
      value: followerSeePosts,
      onChange: (v) => togglePrivacy("followerSeePosts", v, setFollowerSeePosts),
    },
    {
      icon: "chatbubble-ellipses-outline",
      title: "Message Me",
      sub: "Let them start a direct message with you",
      value: followerSendMessages,
      onChange: (v) => togglePrivacy("followerSendMessages", v, setFollowerSendMessages),
    },
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
        <SectionHeader title="Captain Profile" icon="person-circle-outline" />
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

        {/* Vessel Details / Boat customization */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Vessel Details" icon="boat-outline" />
          <SoftCard>
            {/* Live preview */}
            <View style={[styles.boatPreviewCard, { borderColor: colors.border }]}>
              <BoatPreview
                type={boatType}
                color={boatColor || DEFAULT_BOAT_COLOR}
                neon={boatNeon}
                flag={boatFlag}
                accent={boatAccent || undefined}
              />
              <Text style={[styles.boatPreviewName, { color: "#475569" }]}>
                {boatName || "Your boat on the lake"}
              </Text>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Boat Name</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
                ]}
                value={boatName}
                onChangeText={setBoatName}
                placeholder="e.g. Wake Maker"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Boat style */}
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 18 }]}>Boat Style</Text>
            <View style={styles.boatTypeGrid}>
              {BOAT_TYPES.map((t) => {
                const active = boatType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setBoatType(t.value)}
                    style={[
                      styles.boatTypeCard,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + "0D" : colors.card,
                      },
                    ]}
                  >
                    <BoatPreview type={t.value} color={boatColor || DEFAULT_BOAT_COLOR} size={0.66} />
                    <Text style={[styles.boatTypeLabel, { color: colors.foreground }]}>{t.label}</Text>
                    <Text style={[styles.boatTypeDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Boat color */}
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 18 }]}>Boat Color</Text>
            <View style={styles.colorGrid}>
              {BOAT_COLORS.map((c) => {
                const active = boatColor === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setBoatColor(c)}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: c,
                        borderColor: active ? colors.primary : c === "#f8fafc" ? "#e2e8f0" : "transparent",
                        borderWidth: active ? 3 : 1,
                        transform: [{ scale: active ? 1.08 : 1 }],
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Accessories */}
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 18 }]}>Accessories</Text>
            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Neon Glow</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  A glowing halo under your hull
                </Text>
              </View>
              <Switch
                value={boatNeon}
                onValueChange={setBoatNeon}
                trackColor={{ false: colors.muted, true: colors.primary }}
              />
            </View>
            <View style={[styles.toggleRow, { borderColor: colors.border, marginTop: 10 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Pennant Flag</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  Fly a flag off the stern
                </Text>
              </View>
              <Switch
                value={boatFlag}
                onValueChange={setBoatFlag}
                trackColor={{ false: colors.muted, true: colors.primary }}
              />
            </View>

            {(boatNeon || boatFlag) && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Accent Color</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground, marginBottom: 8 }]}>
                  Used for the flag & underglow
                </Text>
                <View style={styles.colorGrid}>
                  {BOAT_COLORS.map((c) => {
                    const active = (boatAccent || boatColor) === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setBoatAccent(c)}
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: c,
                            borderColor: active ? colors.primary : c === "#f8fafc" ? "#e2e8f0" : "transparent",
                            borderWidth: active ? 3 : 1,
                            transform: [{ scale: active ? 1.08 : 1 }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </SoftCard>
        </View>

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

        {/* Privacy */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Privacy" icon="shield-checkmark-outline" />
          <SoftCard padded={false}>
            {privacyRows.map((row, i) => (
              <View
                key={row.title}
                style={[
                  styles.prefRow,
                  styles.prefRowPad,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: row.value ? colors.primary : colors.muted },
                  ]}
                >
                  <Ionicons
                    name={row.icon}
                    size={18}
                    color={row.value ? colors.primaryForeground : colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{row.title}</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{row.sub}</Text>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={row.onChange}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                />
              </View>
            ))}
          </SoftCard>
        </View>

        {/* Followers you don't follow back */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader title="Follower Permissions" icon="people-circle-outline" />
          <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>
            What followers you don't follow back can see
          </Text>
          <SoftCard padded={false}>
            {followerRows.map((row, i) => (
              <View
                key={row.title}
                style={[
                  styles.prefRow,
                  styles.prefRowPad,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: row.value ? colors.primary : colors.muted },
                  ]}
                >
                  <Ionicons
                    name={row.icon}
                    size={18}
                    color={row.value ? colors.primaryForeground : colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{row.title}</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{row.sub}</Text>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={row.onChange}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                />
              </View>
            ))}
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

  boatPreviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dbeafe",
  },
  boatPreviewName: { fontFamily: fonts.sansSemibold, fontSize: 12 },

  boatTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  boatTypeCard: {
    width: "31.5%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 1,
  },
  boatTypeLabel: { fontFamily: fonts.sansSemibold, fontSize: 11.5, textAlign: "center" },
  boatTypeDesc: { fontFamily: fonts.sans, fontSize: 9.5, textAlign: "center" },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 38, height: 38, borderRadius: 19 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },

  sectionNote: { fontFamily: fonts.sans, fontSize: 12.5, marginTop: -6, marginBottom: 12 },

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
  prefRowPad: { paddingHorizontal: 16, paddingVertical: 14 },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15 },
  rowLabel: { fontFamily: fonts.sansSemibold, fontSize: 15.5 },
  rowSub: { fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },

  blockedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  unblockText: { fontFamily: fonts.sansSemibold, fontSize: 13 },
});
