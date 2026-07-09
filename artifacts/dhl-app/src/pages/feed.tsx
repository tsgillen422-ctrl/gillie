import React from "react";
import { useGetPosts, useGetSavedPosts, useReactToPost, useGetMe, useDeletePost, useCreatePost, useToggleRsvp, useSavePost, useUnsavePost, useMuteUser, useBlockUser, useShareToProfile, useVotePoll, useUpdatePost, getGetPostsQueryKey, getGetSavedPostsQueryKey, getGetPostsSummaryQueryKey, getGetBlockedUsersQueryKey, useGetConditions, getGetConditionsQueryKey, useGetCatches, getGetCatchesQueryKey } from "@workspace/api-client-react";
import { PostInputPostType, PostInputVisibility } from "@workspace/api-client-react/src/generated/api.schemas";
import { GifPickerDialog } from "@/components/GifPickerDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { HazardBanner } from "@/components/HazardBanner";
import { TrendingSection } from "@/components/TrendingSection";
import { SuggestedFriendsDrawer, SuggestedFriendsButton } from "@/components/SuggestedFriends";
import { StoriesRow } from "@/components/stories/StoriesRow";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useSearch, useLocation } from "wouter";
import { Heart, MessageCircle, Share2, Calendar, CalendarPlus, MapPin, Trash2, Plus, ImagePlus, X, Send, Video, Check, Users, MoreVertical, MoreHorizontal, Flag, Bookmark, BookmarkCheck, Link2, Repeat2, Anchor, Sailboat, Search, Bell, Sun, Moon, Cloud, CloudSun, CloudMoon, CloudRain, CloudSnow, CloudFog, CloudLightning, Fish, Camera, Waves, Wind, Gauge, AlertTriangle, Info, CheckCircle2, Droplets, Sunrise, Sunset, ChevronRight, Smile, BarChart3, Hash, Globe, Lock, Pencil, EyeOff, Ban, Compass, Sparkles, Flame, Store } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/ReportDialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { resolveImageSrc } from "@/lib/assets";
import { ClickableImage } from "@/components/ClickableImage";
import { MatureGate } from "@/components/MatureGate";
import { REACTIONS, REACTION_MAP, DEFAULT_REACTION, type ReactionKey } from "@/lib/reactions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { PostCard } from "@/components/feed/PostCard";
import { CatchCard } from "@/components/feed/CatchCard";
import { useLake } from "@/lib/lake-context";
import { LakeSwitcher } from "@/components/LakeSwitcher";

const FEELINGS: { emoji: string; label: string }[] = [
  { emoji: "😊", label: "happy" },
  { emoji: "🥳", label: "excited" },
  { emoji: "😎", label: "relaxed" },
  { emoji: "🎣", label: "fishing" },
  { emoji: "🚤", label: "cruising" },
  { emoji: "😍", label: "in love" },
  { emoji: "🙏", label: "blessed" },
  { emoji: "😂", label: "amused" },
  { emoji: "😴", label: "tired" },
  { emoji: "😋", label: "hungry" },
  { emoji: "🤔", label: "curious" },
  { emoji: "😤", label: "determined" },
];

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return "—";
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m[2]} ${ampm}`;
}

function windDirLabel(deg?: number | null): string {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function weatherIcon(code?: number | null, isDay?: boolean) {
  if (code == null) return CloudSun;
  if (code === 0) return isDay === false ? Moon : Sun;
  if (code <= 2) return isDay === false ? CloudMoon : CloudSun;
  if (code === 3) return Cloud;
  if (code >= 45 && code <= 48) return CloudFog;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return CloudSun;
}

const advisoryStyles: Record<string, { wrap: string; icon: typeof Info }> = {
  warning: { wrap: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300", icon: AlertTriangle },
  caution: { wrap: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300", icon: Info },
  good: { wrap: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
};

const pressureStyles: Record<string, { wrap: string; label: string }> = {
  high: { wrap: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300", label: "High" },
  moderate: { wrap: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300", label: "Moderate" },
  low: { wrap: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300", label: "Low" },
};

function ConditionsDrawer({ conditions, open, onOpenChange }: { conditions: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!conditions) return null;
  const WeatherIcon = weatherIcon(conditions.weatherCode, conditions.isDay ?? undefined);
  const metrics: { icon: typeof Info; label: string; value: string; tint: string }[] = [
    { icon: Waves, label: "Water Temp", value: conditions.waterTemperature != null ? `${Math.round(conditions.waterTemperature)}°F` : "—", tint: "text-cyan-500" },
    { icon: Gauge, label: "Lake Level", value: conditions.waterLevel != null ? `${conditions.waterLevel.toFixed(1)} ft` : "—", tint: "text-teal-500" },
    { icon: Wind, label: "Wind", value: `${Math.round(conditions.windSpeed)} mph ${windDirLabel(conditions.windDirection)}`.trim(), tint: "text-sky-500" },
    { icon: Wind, label: "Wind Gust", value: conditions.windGust != null ? `${Math.round(conditions.windGust)} mph` : "—", tint: "text-sky-500" },
    { icon: Droplets, label: "Humidity", value: conditions.humidity != null ? `${Math.round(conditions.humidity)}%` : "—", tint: "text-blue-500" },
    { icon: CloudRain, label: "Precipitation", value: conditions.precipitation != null ? `${conditions.precipitation.toFixed(2)} in` : "—", tint: "text-indigo-500" },
    { icon: Sunrise, label: "Sunrise", value: fmtTime(conditions.sunrise), tint: "text-amber-500" },
    { icon: Sunset, label: "Sunset", value: fmtTime(conditions.sunset), tint: "text-orange-500" },
  ];
  const pressure = conditions.fishingPressure ? (pressureStyles[conditions.fishingPressure.level] ?? pressureStyles.moderate) : null;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Lake Conditions</DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[70vh] overflow-y-auto px-4 pb-8">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <WeatherIcon className="h-12 w-12 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <div className="text-4xl font-bold leading-none">{Math.round(conditions.temperature)}°</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {conditions.weatherLabel}
                {conditions.apparentTemperature != null && ` · feels like ${Math.round(conditions.apparentTemperature)}°`}
              </div>
            </div>
            {conditions.moonPhase && (
              <div className="ml-auto shrink-0 text-center">
                <div className="text-2xl leading-none">{conditions.moonPhase.emoji}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{conditions.moonPhase.name}</div>
                <div className="text-[10px] text-muted-foreground">{conditions.moonPhase.illumination}% lit</div>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5">
                  <m.icon className={`h-4 w-4 shrink-0 ${m.tint}`} />
                  <span className="text-[11px] font-medium text-muted-foreground">{m.label}</span>
                </div>
                <div className="mt-1 text-lg font-semibold leading-none">{m.value}</div>
              </div>
            ))}
          </div>

          {pressure && (
            <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${pressure.wrap}`}>
              <Fish className="mt-0.5 h-4 w-4 shrink-0" />
              <span><span className="font-semibold">Fishing pressure: {pressure.label}.</span> {conditions.fishingPressure.detail}</span>
            </div>
          )}

          {conditions.advisories && conditions.advisories.length > 0 && (
            <div className="mt-3 space-y-2">
              {conditions.advisories.map((a: any, i: number) => {
                const style = advisoryStyles[a.level] ?? advisoryStyles.good;
                const Icon = style.icon;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${style.wrap}`}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><span className="font-semibold">{a.title}.</span> {a.detail}</span>
                  </div>
                );
              })}
            </div>
          )}

          {conditions.updatedAt && (
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Updated {new Date(conditions.updatedAt).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function FeedPage() {
  const [activeTab, setActiveTab] = React.useState<"all" | "friends" | "community" | "event" | "business" | "trending" | "fishing" | "saved">("all");

  const isSavedTab = activeTab === "saved";
  const isTrendingTab = activeTab === "trending";
  const isFishingTab = activeTab === "fishing";
  const { lakeId, lake } = useLake();
  // Friends feed intentionally spans lakes: posts from friends on other lakes
  // appear here (with a lake label on the card). Every other tab is scoped to
  // the currently selected lake community.
  const feedParams =
    activeTab === "friends"
      ? { audience: "friends" as const }
      : activeTab === "community"
        ? { audience: "community" as const, lakeId }
        : activeTab === "event" || activeTab === "business"
          ? { type: activeTab, lakeId }
          : { lakeId };
  const { data: feedPosts, isLoading: feedLoading } = useGetPosts(feedParams, {
    query: { enabled: !isSavedTab && !isTrendingTab && !isFishingTab, queryKey: getGetPostsQueryKey(feedParams) },
  });
  const { data: savedPosts, isLoading: savedLoading } = useGetSavedPosts({
    query: { enabled: isSavedTab, queryKey: getGetSavedPostsQueryKey() },
  });
  const { data: catches, isLoading: catchesLoading } = useGetCatches({ lakeId }, {
    query: { enabled: isFishingTab, queryKey: getGetCatchesQueryKey({ lakeId }) },
  });
  const posts = isSavedTab ? savedPosts : feedPosts;
  const isLoading = isSavedTab ? savedLoading : isFishingTab ? catchesLoading : feedLoading;
  
  const { data: me } = useGetMe();

  const search = useSearch();
  const resolveUrlTab = React.useCallback((s: string): typeof activeTab => {
    const tab = new URLSearchParams(s).get("tab");
    return tab && ["all", "friends", "community", "event", "business", "trending", "fishing", "saved"].includes(tab)
      ? (tab as typeof activeTab)
      : "all";
  }, []);

  React.useEffect(() => {
    setActiveTab(resolveUrlTab(search));
  }, [search, resolveUrlTab]);

  const handledPostRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const params = new URLSearchParams(search);
    const targetId = params.get("post");
    if (!targetId) {
      handledPostRef.current = null;
      return;
    }
    if (handledPostRef.current === targetId) return;
    // Wait until the tab state is in sync with the URL so we read the right dataset.
    if (activeTab !== resolveUrlTab(search)) return;
    if (!posts?.length) return;
    const id = Number(targetId);
    if (!Number.isInteger(id) || !posts.some((p) => p.id === id)) return;
    if (params.get("tab")) {
      const el = document.getElementById(`post-${id}`);
      if (!el) return;
      handledPostRef.current = targetId;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "rounded-2xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-2xl"), 2000);
    } else {
      handledPostRef.current = targetId;
      setOpenPostId(id);
    }
  }, [search, posts, activeTab, resolveUrlTab]);
  const reactPost = useReactToPost();
  const deletePost = useDeletePost();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const toggleRsvp = useToggleRsvp();
  const savePost = useSavePost();
  const unsavePost = useUnsavePost();
  const shareToProfile = useShareToProfile();
  const votePoll = useVotePoll();
  const muteUser = useMuteUser();
  const blockUser = useBlockUser();
  const queryClient = useQueryClient();

  const [editPostId, setEditPostId] = React.useState<number | null>(null);
  const [editType, setEditType] = React.useState<string>("post");
  const [editTitle, setEditTitle] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  const [editVisibility, setEditVisibility] = React.useState<"community" | "friends">("community");
  const [editEventDate, setEditEventDate] = React.useState("");
  const [editEngineSetup, setEditEngineSetup] = React.useState("");
  const [editHorsepower, setEditHorsepower] = React.useState("");
  const [editTopSpeed, setEditTopSpeed] = React.useState("");
  const [editMods, setEditMods] = React.useState("");

  const toDatetimeLocal = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  };

  const openEditPost = (post: any) => {
    setEditPostId(post.id);
    setEditType(post.postType || "post");
    setEditTitle(post.title || "");
    setEditContent(post.content || "");
    setEditVisibility(post.visibility === "friends" ? "friends" : "community");
    setEditEventDate(toDatetimeLocal(post.eventDate));
    setEditEngineSetup(post.engineSetup || "");
    setEditHorsepower(post.horsepower != null ? String(post.horsepower) : "");
    setEditTopSpeed(post.topSpeed != null ? String(post.topSpeed) : "");
    setEditMods(post.mods || "");
  };

  const handleUpdatePost = () => {
    if (editPostId == null) return;
    const isBoatEdit = editType === "boat_showcase";
    const isGatheringEdit = editType === "event" || editType === "tie_up";
    const hp = parseInt(editHorsepower, 10);
    const speed = parseFloat(editTopSpeed);
    updatePost.mutate(
      {
        postId: editPostId,
        data: {
          title: editTitle.trim(),
          content: editContent,
          visibility: editVisibility as PostInputVisibility,
          ...(isGatheringEdit ? { eventDate: editEventDate ? new Date(editEventDate).toISOString() : null } : {}),
          ...(isBoatEdit
            ? {
                engineSetup: editEngineSetup.trim() || null,
                horsepower: Number.isNaN(hp) ? null : hp,
                topSpeed: Number.isNaN(speed) ? null : speed,
                mods: editMods.trim() || null,
              }
            : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Post updated.");
          setEditPostId(null);
          refreshPosts();
        },
        onError: () => toast.error("Couldn't update that post."),
      }
    );
  };

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [openPostId, setOpenPostId] = React.useState<number | null>(null);
  const openPost = openPostId != null ? posts?.find((p) => p.id === openPostId) ?? null : null;
  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");
  const [newType, setNewType] = React.useState<"post" | "event" | "business" | "tie_up" | "boat_showcase">("post");
  const [newEventDate, setNewEventDate] = React.useState("");
  const [newImageUrl, setNewImageUrl] = React.useState<string | null>(null);
  const [newVideoUrl, setNewVideoUrl] = React.useState<string | null>(null);
  const [newPhotos, setNewPhotos] = React.useState<string[]>([]);
  const [newEngineSetup, setNewEngineSetup] = React.useState("");
  const [newHorsepower, setNewHorsepower] = React.useState("");
  const [newTopSpeed, setNewTopSpeed] = React.useState("");
  const [newMods, setNewMods] = React.useState("");
  const [newFeeling, setNewFeeling] = React.useState<{ emoji: string; label: string } | null>(null);
  const [newTopics, setNewTopics] = React.useState<string[]>([]);
  const [newLocation, setNewLocation] = React.useState("");
  const [newGifUrl, setNewGifUrl] = React.useState<string | null>(null);
  const [pollOptions, setPollOptions] = React.useState<string[]>([]);
  const [newVisibility, setNewVisibility] = React.useState<"community" | "friends">("community");
  const [feelingOpen, setFeelingOpen] = React.useState(false);
  const [topicsOpen, setTopicsOpen] = React.useState(false);
  const [topicDraft, setTopicDraft] = React.useState("");
  const [locationOpen, setLocationOpen] = React.useState(false);
  const [locationDraft, setLocationDraft] = React.useState("");
  const [gifOpen, setGifOpen] = React.useState(false);
  const pollActive = pollOptions.length > 0;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const boatPhotosInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();

  const refreshPosts = () => {
    queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPostsSummaryQueryKey() });
  };

  const handleDeletePost = (postId: number) => {
    deletePost.mutate(
      { postId },
      {
        onSuccess: () => {
          toast.success("Post deleted.");
          refreshPosts();
        },
        onError: () => toast.error("Couldn't delete that post."),
      }
    );
  };

  const resetComposer = () => {
    setNewTitle("");
    setNewContent("");
    setNewType("post");
    setNewEventDate("");
    setNewImageUrl(null);
    setNewVideoUrl(null);
    setNewPhotos([]);
    setNewEngineSetup("");
    setNewHorsepower("");
    setNewTopSpeed("");
    setNewMods("");
    setNewFeeling(null);
    setNewTopics([]);
    setNewLocation("");
    setNewGifUrl(null);
    setPollOptions([]);
    setNewVisibility("community");
    setTopicDraft("");
    setLocationDraft("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (boatPhotosInputRef.current) boatPhotosInputRef.current.value = "";
  };

  const handleBoatPhotosSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (boatPhotosInputRef.current) boatPhotosInputRef.current.value = "";
    if (!files.length) return;
    const remaining = 8 - newPhotos.length;
    if (remaining <= 0) {
      toast.error("You can add up to 8 photos.");
      return;
    }
    const toUpload = files.filter((f) => f.type.startsWith("image/")).slice(0, remaining);
    if (!toUpload.length) {
      toast.error("Please choose image files.");
      return;
    }
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const res = await uploadFile(await compressImage(file));
        if (res?.objectPath) uploaded.push(`/api/storage${res.objectPath}`);
      }
      if (uploaded.length) setNewPhotos((prev) => [...prev, ...uploaded]);
      else toast.error("Couldn't upload those photos.");
    } catch {
      toast.error("Couldn't upload those photos.");
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      const res = await uploadFile(await compressImage(file));
      if (res?.objectPath) {
        setNewImageUrl(res.objectPath);
        setNewVideoUrl(null);
        setNewGifUrl(null);
        if (videoInputRef.current) videoInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that photo.");
      }
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    try {
      const res = await uploadFile(file);
      if (res?.objectPath) {
        setNewVideoUrl(res.objectPath);
        setNewImageUrl(null);
        setNewGifUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that video.");
      }
    } catch {
      toast.error("Couldn't upload that video.");
    }
  };

  const addTopic = () => {
    const t = topicDraft.trim().replace(/^#+/, "").replace(/[^\w]/g, "");
    if (!t) return;
    setNewTopics((prev) => (prev.includes(t) || prev.length >= 10 ? prev : [...prev, t]));
    setTopicDraft("");
  };

  const handleSelectGif = (url: string) => {
    setNewGifUrl(url);
    setNewImageUrl(null);
    setNewVideoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    setGifOpen(false);
  };

  const handleCreatePost = () => {
    const isBoat = newType === "boat_showcase";
    const validPollOptions = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    const hasExtras = !!(newGifUrl || newImageUrl || newVideoUrl || newFeeling || newLocation.trim() || newTopics.length || validPollOptions.length >= 2);
    if (!isBoat && !newContent.trim() && !hasExtras) {
      toast.error("Add something to your post.");
      return;
    }
    if (newType === "event" && !newEventDate) {
      toast.error("Pick a date for your event.");
      return;
    }
    if (isBoat && newPhotos.length === 0) {
      toast.error("Add at least one photo of your boat.");
      return;
    }
    if (pollActive && validPollOptions.length < 2) {
      toast.error("Add at least two poll choices.");
      return;
    }
    const hp = parseInt(newHorsepower, 10);
    const speed = parseFloat(newTopSpeed);
    const body = newContent.trim();
    const head: string[] = [];
    if (newFeeling) head.push(`${newFeeling.emoji} Feeling ${newFeeling.label}`);
    const tail: string[] = [];
    if (newLocation.trim()) tail.push(`📍 ${newLocation.trim()}`);
    if (newTopics.length) tail.push(newTopics.map((t) => `#${t}`).join(" "));
    const composedContent = [...head, body, ...tail].filter(Boolean).join("\n\n");
    createPost.mutate(
      {
        data: {
          title: newTitle.trim() || (newType === "event" ? "Event" : newType === "tie_up" ? "Tie-up" : isBoat ? "Boat Showcase" : "Post"),
          content: composedContent || (isBoat ? "Check out this boat!" : ""),
          postType: newType as PostInputPostType,
          eventDate: (newType === "event" || newType === "tie_up") && newEventDate ? new Date(newEventDate).toISOString() : undefined,
          imageUrl: newGifUrl ?? (newImageUrl ? `/api/storage${newImageUrl}` : undefined),
          videoUrl: newVideoUrl ? `/api/storage${newVideoUrl}` : undefined,
          photos: isBoat && newPhotos.length ? newPhotos : undefined,
          engineSetup: isBoat && newEngineSetup.trim() ? newEngineSetup.trim() : undefined,
          horsepower: isBoat && !Number.isNaN(hp) ? hp : undefined,
          topSpeed: isBoat && !Number.isNaN(speed) ? speed : undefined,
          mods: isBoat && newMods.trim() ? newMods.trim() : undefined,
          visibility: newVisibility as PostInputVisibility,
          pollOptions: validPollOptions.length >= 2 ? validPollOptions : undefined,
          lakeId,
        },
      },
      {
        onSuccess: () => {
          toast.success("Post shared!");
          setComposerOpen(false);
          resetComposer();
          refreshPosts();
        },
        onError: () => toast.error("Couldn't share your post."),
      }
    );
  };

  const { data: conditions } = useGetConditions({ lakeId }, { query: { refetchInterval: 1000 * 60 * 10, queryKey: getGetConditionsQueryKey({ lakeId }) } });
  const [conditionsOpen, setConditionsOpen] = React.useState(false);
  const WeatherIcon = weatherIcon(conditions?.weatherCode, conditions?.isDay ?? undefined);

  const [tabBarHidden, setTabBarHidden] = React.useState(false);
  const lastScrollTopRef = React.useRef(0);
  const scrollTickingRef = React.useRef(false);
  const tabBarSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (scrollTickingRef.current) return;
    scrollTickingRef.current = true;
    requestAnimationFrame(() => {
      scrollTickingRef.current = false;
      const y = el.scrollTop;
      const last = lastScrollTopRef.current;
      const delta = y - last;
      // Where the tab bar starts sticking (its natural position in the flow).
      const stickyStart = tabBarSentinelRef.current?.offsetTop ?? 240;
      if (y <= stickyStart) {
        // Bar is still in (or near) its natural in-flow spot: hiding it here
        // would leave a visible gap and cause a jump, so always show it.
        setTabBarHidden(false);
      } else if (delta > 6) {
        setTabBarHidden(true);
      } else if (delta < -6) {
        setTabBarHidden(false);
      }
      lastScrollTopRef.current = y;
    });
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("compose") === "1") {
      setComposerOpen(true);
      const type = params.get("type");
      if (type === "event" || type === "tie_up" || type === "boat_showcase" || type === "business") {
        setNewType(type);
      }
      params.delete("compose");
      params.delete("type");
      const qs = params.toString();
      window.history.replaceState(null, "", `${import.meta.env.BASE_URL.replace(/\/$/, "")}/feed${qs ? `?${qs}` : ""}`);
    }
  }, [search]);

  return (
    <div className="relative flex flex-col h-full min-w-0 bg-muted/30">
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {/* Slim top bar */}
        <div className="bg-background px-4 pb-2" style={{ paddingTop: "max(env(safe-area-inset-top), 0.6rem)" }}>
          <div className="flex items-center justify-between pt-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-script text-[30px] font-bold leading-none text-primary">Gillie</span>
              <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
              <LakeSwitcher className="min-w-0 text-sm" />
              <Link
                href="/lakes"
                aria-label="Explore lakes"
                data-testid="button-explore-lakes-feed"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base hover:bg-muted active:scale-95 transition"
              >
                <span aria-hidden>🌎</span>
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/search" aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition">
                <Search className="h-[20px] w-[20px]" />
              </Link>
              <Link href="/pins" aria-label="Pins" className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition">
                <MapPin className="h-[20px] w-[20px]" />
              </Link>
              <Link href="/friends" aria-label="Friends" className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition">
                <Users className="h-[20px] w-[20px]" />
              </Link>
              <Link href="/notifications" aria-label="Notifications" className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition">
                <Bell className="h-[20px] w-[20px]" />
              </Link>
              {me && (
                <Link href="/profile/me" aria-label="Your profile" className="ml-0.5 rounded-full ring-2 ring-primary/40 active:scale-95 transition">
                  <UserAvatar name={me.displayName || "You"} username={me.username || ""} avatarUrl={me.avatarUrl} className="h-8 w-8" />
                </Link>
              )}
            </div>
          </div>

          {/* Compact expandable weather strip */}
          <button
            type="button"
            onClick={() => conditions && setConditionsOpen(true)}
            disabled={!conditions}
            aria-label="View detailed weather conditions"
            aria-expanded={conditionsOpen}
            className="mt-2.5 flex w-full items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-2 text-left transition active:scale-[0.99]"
          >
            {conditions ? (
              <>
                <WeatherIcon className="h-5 w-5 shrink-0 text-amber-500" />
                <span className="text-sm font-bold leading-none">{Math.round(conditions.temperature)}°</span>
                <span className="hidden min-[380px]:inline truncate text-xs text-muted-foreground">{conditions.weatherLabel}</span>
                <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Waves className="h-3.5 w-3.5 text-cyan-500" />{conditions.waterTemperature != null ? `${Math.round(conditions.waterTemperature)}°` : "—"}</span>
                  <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5 text-sky-500" />{Math.round(conditions.windSpeed)}</span>
                  <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-teal-500" />{conditions.waterLevel != null ? conditions.waterLevel.toFixed(1) : "—"}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </>
            ) : (
              <>
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 flex-1" />
              </>
            )}
          </button>
        </div>

        <ConditionsDrawer conditions={conditions ?? null} open={conditionsOpen} onOpenChange={setConditionsOpen} />

        <SuggestedFriendsDrawer />

        {/* Stories: front and center */}
        <div className="bg-background px-4 pb-3 pt-1">
          <StoriesRow />
        </div>

        {/* Filter tabs: stick to the top once the hero scrolls away; hide on scroll down, reveal on scroll up */}
        <div ref={tabBarSentinelRef} aria-hidden="true" />
        <div className={`sticky top-0 z-20 pt-3 pb-2 bg-muted/90 backdrop-blur-xl border-b border-border/40 shadow-sm transition-transform duration-300 ease-out ${tabBarHidden ? "-translate-y-full" : "translate-y-0"}`}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
            {/* Explore opens the Explore hub page (not a feed filter). */}
            <Link
              href="/explore"
              data-testid="tab-explore"
              className="shrink-0 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-foreground shadow-sm ring-1 ring-black/5 hover:bg-black/5 transition-colors"
            >
              <Compass className="h-4 w-4 text-primary" /> Explore
            </Link>
            {([
              ["all", "For You", Sparkles],
              ["friends", "Friends", Users],
              ["community", "Community", Waves],
              // Secondary filters only appear when reached from the Explore
              // hub (?tab=...), keeping the main bar as the four mockup pills.
              ...((["event", "fishing", "trending", "business", "saved"] as const).includes(activeTab as any)
                ? [[activeTab, { event: "Events", fishing: "Fishing", trending: "Trending", business: "Local", saved: "Saved" }[activeTab as "event" | "fishing" | "trending" | "business" | "saved"], { event: Calendar, fishing: Fish, trending: Flame, business: Store, saved: Bookmark }[activeTab as "event" | "fishing" | "trending" | "business" | "saved"]] as const]
                : []),
            ] as ReadonlyArray<readonly [string, string, React.ComponentType<{ className?: string }>]>).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value as any)}
                data-testid={`tab-${value}`}
                className={`relative shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all duration-300 ${activeTab === value ? "bg-primary text-primary-foreground shadow-md" : "bg-white text-muted-foreground shadow-sm ring-1 ring-black/5 hover:bg-black/5 hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
        <HazardBanner />
        {isTrendingTab ? (
          <TrendingSection />
        ) : isLoading ? (
          <div className="space-y-4 mt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-none shadow-soft rounded-[20px] bg-card/60 overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2 border-none">
                  <Skeleton className="w-11 h-11 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3 rounded-full" />
                    <Skeleton className="h-3 w-1/4 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Skeleton className="h-[300px] w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isFishingTab ? (
          catches?.length ? (
            <div className="space-y-5 mt-2">
              {catches.map(catchData => (
                <CatchCard key={catchData.id} catchData={catchData} href={`/catches?catch=${catchData.id}`} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <Fish className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="font-display font-semibold text-xl mb-1">No catches yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Log a catch to share it with the community.
              </p>
            </div>
          )
        ) : posts?.length ? (
          <div className="space-y-5 mt-2 -mx-2">
            {posts.map((post, postIndex) => (
              <React.Fragment key={post.id}>
              <div id={`post-${post.id}`}>
                <PostCard
                  post={post}
                  onReact={(reaction: any) => reactPost.mutate({ postId: post.id, data: { reaction } }, { onSuccess: refreshPosts })}
                  canDelete={me != null && (post.userId === me.id || me.isAdmin)}
                  onDelete={() => handleDeletePost(post.id)}
                  onUpdatePost={() => openEditPost(post)}
                  currentUserId={me?.id}
                  onOpen={() => setOpenPostId(post.id)}
                  votePoll={votePoll}
                  getGetPostsQueryKey={getGetPostsQueryKey}
                  getGetSavedPostsQueryKey={getGetSavedPostsQueryKey}
                  onToggleRsvp={(postId: number) => toggleRsvp.mutate({ postId }, { onSuccess: refreshPosts })}
                  onSave={(postId: number) => savePost.mutate({ postId }, { onSuccess: refreshPosts })}
                  onUnsave={(postId: number) => unsavePost.mutate({ postId }, { onSuccess: refreshPosts })}
                  onShareToProfile={(postId: number) => shareToProfile.mutate({ postId }, { onSuccess: refreshPosts })}
                  onMuteUser={(userId: number) => muteUser.mutate({ userId }, { onSuccess: refreshPosts })}
                  onBlockUser={(userId: number) => blockUser.mutate({ userId }, { onSuccess: refreshPosts })}
                />
              </div>
              {postIndex === Math.min(2, posts.length - 1) && (
                <div className="px-2">
                  <SuggestedFriendsButton />
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Anchor className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-xl mb-1">Nothing here yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Be the first to share what's happening on the lake. Tap the + button to post.
            </p>
          </div>
        )}
        </div>
      </div>


      <Dialog open={!!openPost} onOpenChange={(o) => { if (!o) setOpenPostId(null); }}>
        <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] overflow-y-auto border-0 bg-transparent shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{openPost?.title || "Post"}</DialogTitle>
            <DialogDescription>Post details and comments</DialogDescription>
          </DialogHeader>
          {openPost && (
            <PostCard
              post={openPost}
              onReact={(reaction: any) => reactPost.mutate({ postId: openPost.id, data: { reaction } }, { onSuccess: refreshPosts })}
              canDelete={me != null && (openPost.userId === me.id || me.isAdmin)}
              onDelete={() => handleDeletePost(openPost.id)}
              onUpdatePost={() => openEditPost(openPost)}
              currentUserId={me?.id}
              votePoll={votePoll}
              getGetPostsQueryKey={getGetPostsQueryKey}
              getGetSavedPostsQueryKey={getGetSavedPostsQueryKey}
              onToggleRsvp={(postId: number) => toggleRsvp.mutate({ postId }, { onSuccess: refreshPosts })}
              onSave={(postId: number) => savePost.mutate({ postId }, { onSuccess: refreshPosts })}
              onUnsave={(postId: number) => unsavePost.mutate({ postId }, { onSuccess: refreshPosts })}
              onShareToProfile={(postId: number) => shareToProfile.mutate({ postId }, { onSuccess: refreshPosts })}
              onMuteUser={(userId: number) => muteUser.mutate({ userId }, { onSuccess: refreshPosts })}
              onBlockUser={(userId: number) => blockUser.mutate({ userId }, { onSuccess: refreshPosts })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editPostId != null} onOpenChange={(o) => { if (!o) setEditPostId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>Update the details of your post.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(editType === "event" || editType === "tie_up" || editType === "boat_showcase") && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="input-edit-title" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="edit-content">What's on your mind?</Label>
              <Textarea id="edit-content" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} data-testid="input-edit-content" />
            </div>
            {(editType === "event" || editType === "tie_up") && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-event-date">Date &amp; time</Label>
                <Input id="edit-event-date" type="datetime-local" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} data-testid="input-edit-event-date" />
              </div>
            )}
            {editType === "boat_showcase" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="edit-engine">Engine setup</Label>
                  <Input id="edit-engine" value={editEngineSetup} onChange={(e) => setEditEngineSetup(e.target.value)} data-testid="input-edit-engine" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-hp">Horsepower</Label>
                  <Input id="edit-hp" type="number" inputMode="numeric" value={editHorsepower} onChange={(e) => setEditHorsepower(e.target.value)} data-testid="input-edit-hp" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-speed">Top speed (mph)</Label>
                  <Input id="edit-speed" type="number" inputMode="decimal" value={editTopSpeed} onChange={(e) => setEditTopSpeed(e.target.value)} data-testid="input-edit-speed" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="edit-mods">Mods</Label>
                  <Input id="edit-mods" value={editMods} onChange={(e) => setEditMods(e.target.value)} data-testid="input-edit-mods" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="edit-visibility">Who can see this?</Label>
              <Select value={editVisibility} onValueChange={(v) => setEditVisibility(v as "community" | "friends")}>
                <SelectTrigger id="edit-visibility" data-testid="select-edit-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleUpdatePost} disabled={updatePost.isPending} data-testid="button-save-edit">
              {updatePost.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={composerOpen} onOpenChange={(open) => { setComposerOpen(open); if (!open) resetComposer(); }}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
            <DialogTitle className="text-base font-semibold">Create Post</DialogTitle>
            <Button
              type="button"
              onClick={handleCreatePost}
              disabled={createPost.isPending || isUploading}
              className="h-9 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              {createPost.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
          <DialogDescription className="sr-only">Share something with the {lake.name} community.</DialogDescription>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={me?.displayName || "You"} username={me?.username || ""} avatarUrl={me?.avatarUrl} className="h-11 w-11 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold leading-tight">{me?.displayName || "You"}</div>
                <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                  <SelectTrigger className="mt-1 h-7 w-auto gap-1.5 rounded-full border-border bg-muted/60 px-2.5 py-0 text-xs font-medium">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Social</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="tie_up">Tie-up</SelectItem>
                    <SelectItem value="business">Local</SelectItem>
                    <SelectItem value="boat_showcase">🚤 Boat Showcase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={newType === "boat_showcase" ? "Tell the story behind your build…" : newType === "tie_up" ? "Drop the spot where everyone's tying up…" : "What's on your mind?"}
              rows={newType === "boat_showcase" ? 3 : 4}
              className="resize-none border-0 px-0 text-lg shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            />

            {newType !== "boat_showcase" && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
                {newGifUrl ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                    <img src={newGifUrl} alt="Selected GIF" className="h-full w-full object-contain" />
                    <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">GIF</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() => setNewGifUrl(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : newImageUrl ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                    <img src={`/api/storage${newImageUrl}`} alt="Selected" className="h-full w-full object-cover" />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() => { setNewImageUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : newVideoUrl ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                    <video src={`/api/storage${newVideoUrl}`} controls className="h-full w-full" />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() => { setNewVideoUrl(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}

                {(newFeeling || newLocation.trim() || newTopics.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {newFeeling && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {newFeeling.emoji} Feeling {newFeeling.label}
                        <button type="button" onClick={() => setNewFeeling(null)} className="ml-0.5"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {newLocation.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                        <MapPin className="h-3 w-3" /> {newLocation.trim()}
                        <button type="button" onClick={() => setNewLocation("")} className="ml-0.5"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {newTopics.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
                        #{t}
                        <button type="button" onClick={() => setNewTopics((prev) => prev.filter((x) => x !== t))} className="ml-0.5"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}

                {pollActive && (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Poll</span>
                      <button type="button" onClick={() => setPollOptions([])} className="text-xs text-muted-foreground transition hover:text-foreground">Remove poll</button>
                    </div>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input value={opt} maxLength={80} placeholder={`Option ${i + 1}`} onChange={(e) => setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))} />
                        {pollOptions.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPollOptions((prev) => [...prev, ""])}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add option
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-around border-y border-border py-2">
                  <button type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition hover-elevate active:scale-95 disabled:opacity-50">
                    <ImagePlus className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">{isUploading ? "Uploading..." : "Photo"}</span>
                  </button>
                  <button type="button" disabled={isUploading} onClick={() => videoInputRef.current?.click()} className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition hover-elevate active:scale-95 disabled:opacity-50">
                    <Video className="h-5 w-5 text-indigo-500" />
                    <span className="text-sm font-medium">Video</span>
                  </button>
                  <Popover open={feelingOpen} onOpenChange={setFeelingOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition hover-elevate active:scale-95">
                        <Smile className="h-5 w-5 text-amber-500" />
                        <span className="text-sm font-medium">Feeling</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2">
                      <div className="grid grid-cols-4 gap-1">
                        {FEELINGS.map((f) => (
                          <button key={f.label} type="button" onClick={() => { setNewFeeling(f); setFeelingOpen(false); }} className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-center hover-elevate active:scale-95">
                            <span className="text-xl">{f.emoji}</span>
                            <span className="text-[10px] text-muted-foreground">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button type="button" onClick={() => setPollOptions((prev) => (prev.length ? prev : ["", ""]))} className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition hover-elevate active:scale-95">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-medium">Poll</span>
                  </button>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{newType === "boat_showcase" ? "Boat name / title" : "Add a title"} <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <span className="text-xs text-muted-foreground">{newTitle.length}/100</span>
              </div>
              <Input maxLength={100} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={newType === "boat_showcase" ? "e.g. Reel Therapy — 24' Sea Ray" : "Give your post a title"} />
            </div>

            {(newType === "event" || newType === "tie_up") && (
              <div className="space-y-1.5">
                <Label>{newType === "tie_up" ? "When (optional)" : "Event date"}</Label>
                <Input type="datetime-local" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
              </div>
            )}

            {newType !== "boat_showcase" && (
              <>
                <button type="button" onClick={() => { setTopicDraft(""); setTopicsOpen(true); }} className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition hover-elevate active:scale-[0.99]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
                    <Hash className="h-4 w-4 text-sky-500" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Add topics</span>
                    <span className="block truncate text-xs text-muted-foreground">{newTopics.length ? newTopics.map((t) => `#${t}`).join(" ") : "Help others discover your post"}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>

                <button type="button" onClick={() => { setLocationDraft(newLocation); setLocationOpen(true); }} className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition hover-elevate active:scale-[0.99]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                    <MapPin className="h-4 w-4 text-rose-500" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Add location</span>
                    <span className="block truncate text-xs text-muted-foreground">{newLocation.trim() || "Tag where this is happening"}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>

                <div className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                    <Users className="h-4 w-4 text-teal-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Audience</div>
                    <div className="truncate text-xs text-muted-foreground">Who can see this post</div>
                  </div>
                  <Select value={newVisibility} onValueChange={(v) => setNewVisibility(v as "community" | "friends")}>
                    <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-border bg-muted/60 px-3 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="community">
                        <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {lake.name} Community</span>
                      </SelectItem>
                      <SelectItem value="friends">
                        <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Friends only</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setGifOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-bold text-emerald-600 transition hover-elevate active:scale-95 dark:text-emerald-400">
                    GIF
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition hover-elevate active:scale-95" aria-label="More options">
                        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setGifOpen(true)}>Add a GIF</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPollOptions((prev) => (prev.length ? prev : ["", ""]))}>Add a poll</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setTopicDraft(""); setTopicsOpen(true); }}>Add topics</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setLocationDraft(newLocation); setLocationOpen(true); }}>Add location</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={resetComposer}>Clear post</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}

            {newType === "boat_showcase" && (
              <>
                <div className="space-y-1.5">
                  <Label>Engine setup</Label>
                  <Input value={newEngineSetup} onChange={(e) => setNewEngineSetup(e.target.value)} placeholder="e.g. Twin Mercury 400R Verado" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Horsepower</Label>
                    <Input type="number" inputMode="numeric" value={newHorsepower} onChange={(e) => setNewHorsepower(e.target.value)} placeholder="e.g. 800" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Top speed (mph)</Label>
                    <Input type="number" inputMode="decimal" value={newTopSpeed} onChange={(e) => setNewTopSpeed(e.target.value)} placeholder="e.g. 72" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Mods</Label>
                  <Textarea value={newMods} onChange={(e) => setNewMods(e.target.value)} placeholder="e.g. Custom prop, hydraulic jack plate, JL Audio system" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Photos</Label>
                  <input ref={boatPhotosInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBoatPhotosSelect} />
                  {newPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {newPhotos.map((url, i) => (
                        <div key={`${url}-${i}`} className="relative rounded-lg overflow-hidden bg-muted aspect-square">
                          <img src={url} alt={`Boat ${i + 1}`} className="object-cover w-full h-full" />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => setNewPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {newPhotos.length < 8 && (
                    <Button type="button" variant="outline" className="w-full" disabled={isUploading} onClick={() => boatPhotosInputRef.current?.click()}>
                      <ImagePlus className="w-4 h-4 mr-2" />
                      {isUploading ? "Uploading..." : newPhotos.length ? "Add more photos" : "Add photos"}
                    </Button>
                  )}
                </div>
              </>
            )}

          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={topicsOpen} onOpenChange={setTopicsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add topics</DialogTitle>
            <DialogDescription>Add hashtags so others can find your post.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={topicDraft}
              onChange={(e) => setTopicDraft(e.target.value)}
              placeholder="e.g. fishing"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }}
            />
            <Button type="button" onClick={addTopic} disabled={!topicDraft.trim()}>Add</Button>
          </div>
          {newTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {newTopics.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
                  #{t}
                  <button type="button" onClick={() => setNewTopics((prev) => prev.filter((x) => x !== t))} className="ml-0.5"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setTopicsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationOpen} onOpenChange={setLocationOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add location</DialogTitle>
            <DialogDescription>Where is this happening?</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="e.g. Sulphur Creek Marina"
              className="pl-9"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setNewLocation(locationDraft.trim()); setLocationOpen(false); } }}
            />
          </div>
          <DialogFooter>
            {newLocation.trim() && (
              <Button type="button" variant="ghost" onClick={() => { setNewLocation(""); setLocationDraft(""); setLocationOpen(false); }}>Remove</Button>
            )}
            <Button type="button" onClick={() => { setNewLocation(locationDraft.trim()); setLocationOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GifPickerDialog open={gifOpen} onOpenChange={setGifOpen} onSelect={handleSelectGif} />
    </div>
  );
}

