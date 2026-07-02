import React from "react";
import { useGetPosts, useGetSavedPosts, useGetPostsSummary, useReactToPost, useGetMe, useDeletePost, useCreatePost, useGetPostComments, useGetPostLikes, useCreatePostComment, useDeletePostComment, useReactToComment, useToggleRsvp, useSavePost, useUnsavePost, useMuteUser, useBlockUser, useShareToProfile, useVotePoll, useUpdatePost, getGetPostsQueryKey, getGetSavedPostsQueryKey, getGetPostsSummaryQueryKey, getGetPostCommentsQueryKey, getGetBlockedUsersQueryKey, useGetConditions } from "@workspace/api-client-react";
import { PostInputPostType, PostInputVisibility } from "@workspace/api-client-react/src/generated/api.schemas";
import { GifPickerDialog } from "@/components/GifPickerDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { HazardBanner } from "@/components/HazardBanner";
import { TrendingSection } from "@/components/TrendingSection";
import { SuggestedFriendsDrawer, SuggestedFriendsButton } from "@/components/SuggestedFriends";
import { StoriesRow } from "@/components/stories/StoriesRow";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "wouter";
import { Heart, MessageCircle, Share2, Calendar, CalendarPlus, MapPin, Trash2, Plus, ImagePlus, X, Send, Video, Check, Users, MoreVertical, MoreHorizontal, Flag, Bookmark, BookmarkCheck, Link2, Repeat2, Anchor, Sailboat, Search, Bell, Sun, Moon, Cloud, CloudSun, CloudMoon, CloudRain, CloudSnow, CloudFog, CloudLightning, Fish, Camera, Waves, Wind, Gauge, AlertTriangle, Info, CheckCircle2, Droplets, Sunrise, Sunset, ChevronRight, Smile, BarChart3, Hash, Globe, Lock, Pencil, EyeOff, Ban } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/ReportDialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import heroImg from "@assets/hero-lake-sunset.webp";
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

function PollView({ post }: { post: any }) {
  const queryClient = useQueryClient();
  const votePoll = useVotePoll();
  const poll = post.poll as { options: { id: number; text: string; voteCount: number }[]; totalVotes: number; myVote?: number | null } | undefined;
  if (!poll || !poll.options?.length) return null;
  const total = poll.totalVotes || 0;
  const myVote = poll.myVote ?? null;
  const handleVote = (optionId: number) => {
    if (votePoll.isPending) return;
    votePoll.mutate(
      { postId: post.id, data: { optionId } },
      { onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
      } },
    );
  };
  return (
    <div className="mt-3 space-y-2">
      {poll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
        const mine = myVote === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={votePoll.isPending}
            onClick={() => handleVote(opt.id)}
            className="relative w-full overflow-hidden rounded-lg border border-border px-3 py-2 text-left transition hover-elevate active:scale-[0.99] disabled:opacity-70"
          >
            <span className={`absolute inset-y-0 left-0 ${mine ? "bg-primary/20" : "bg-muted"}`} style={{ width: `${pct}%` }} aria-hidden />
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                {mine && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <span className="truncate">{opt.text}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{pct}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground">{total} {total === 1 ? "vote" : "votes"}{myVote ? " · Tap to change" : ""}</p>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = React.useState<"all" | "friends" | "community" | "event" | "business" | "trending" | "saved">("all");

  const isSavedTab = activeTab === "saved";
  const isTrendingTab = activeTab === "trending";
  const feedParams =
    activeTab === "friends"
      ? { audience: "friends" as const }
      : activeTab === "community"
        ? { audience: "community" as const }
        : activeTab === "event" || activeTab === "business"
          ? { type: activeTab }
          : {};
  const { data: feedPosts, isLoading: feedLoading } = useGetPosts(feedParams, {
    query: { enabled: !isSavedTab && !isTrendingTab },
  });
  const { data: savedPosts, isLoading: savedLoading } = useGetSavedPosts({
    query: { enabled: isSavedTab },
  });
  const posts = isSavedTab ? savedPosts : feedPosts;
  const isLoading = isSavedTab ? savedLoading : feedLoading;
  
  const { data: summary } = useGetPostsSummary();
  const { data: me } = useGetMe();

  const search = useSearch();
  const resolveUrlTab = React.useCallback((s: string): typeof activeTab => {
    const tab = new URLSearchParams(s).get("tab");
    return tab && ["all", "friends", "community", "event", "business", "trending", "saved"].includes(tab)
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

  const { data: conditions } = useGetConditions({ query: { refetchInterval: 1000 * 60 * 10 } });
  const [conditionsOpen, setConditionsOpen] = React.useState(false);
  const greetingPrefix = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good Morning";
    if (h >= 12 && h < 17) return "Good Afternoon";
    return "Good Evening";
  })();
  const firstName = me?.displayName?.trim().split(/\s+/)[0] || me?.username || "friend";
  const WeatherIcon = weatherIcon(conditions?.weatherCode, conditions?.isDay ?? undefined);

  React.useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("compose") === "1") {
      setComposerOpen(true);
      params.delete("compose");
      const qs = params.toString();
      window.history.replaceState(null, "", `/feed${qs ? `?${qs}` : ""}`);
    }
  }, [search]);

  return (
    <div className="flex flex-col h-full min-w-0 bg-muted/30">
      <div className="flex-1 overflow-y-auto">
        {/* Immersive hero: scrolls away with the page */}
        <div className="relative isolate">
          <img
            src={heroImg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover select-none"
            draggable={false}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/25 to-black/75" />
          <div className="px-4 pb-5" style={{ paddingTop: "max(env(safe-area-inset-top), 0.85rem)" }}>
            {/* Top bar */}
            <div className="flex items-center justify-between pt-1.5">
              <span className="font-script text-[34px] font-bold leading-none text-white drop-shadow-md">Gillie</span>
              <div className="flex items-center gap-2">
                <Link href="/search" aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 active:scale-95 transition">
                  <Search className="h-[18px] w-[18px]" />
                </Link>
                <Link href="/pins" aria-label="Pins" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 active:scale-95 transition">
                  <MapPin className="h-[18px] w-[18px]" />
                </Link>
                <Link href="/friends" aria-label="Friends" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 active:scale-95 transition">
                  <Users className="h-[18px] w-[18px]" />
                </Link>
                <Link href="/notifications" aria-label="Notifications" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 active:scale-95 transition">
                  <Bell className="h-[18px] w-[18px]" />
                </Link>
                {me && (
                  <Link href="/profile/me" aria-label="Your profile" className="rounded-full ring-2 ring-white/70 active:scale-95 transition">
                    <UserAvatar name={me.displayName || "You"} username={me.username || ""} avatarUrl={me.avatarUrl} className="h-9 w-9" />
                  </Link>
                )}
              </div>
            </div>

            {/* Greeting */}
            <div className="mt-12">
              <h1 className="text-[26px] font-bold leading-tight text-white drop-shadow-md">
                {greetingPrefix},<br />{firstName} <span aria-hidden="true">👋</span>
              </h1>
              <p className="mt-1 text-sm text-white/85 drop-shadow">Dale Hollow Lake is looking great today.</p>
            </div>

            {/* Conditions glass card */}
            <button
              type="button"
              onClick={() => conditions && setConditionsOpen(true)}
              disabled={!conditions}
              aria-label="View detailed weather conditions"
              className="mt-4 block w-full rounded-2xl border border-white/15 bg-black/35 p-3.5 text-left text-white backdrop-blur-md transition active:scale-[0.99]"
            >
              {conditions ? (
                <div className="flex items-center gap-2.5">
                  <WeatherIcon className="h-9 w-9 shrink-0 text-amber-300" />
                  <div className="min-w-0 shrink border-r border-white/20 pr-2.5">
                    <div className="text-[26px] font-bold leading-none">{Math.round(conditions.temperature)}°</div>
                    <div className="mt-1 truncate text-[11px] leading-none text-white/75">
                      {conditions.weatherLabel}
                      {conditions.apparentTemperature != null && ` · feels ${Math.round(conditions.apparentTemperature)}°`}
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-1 text-center">
                    <div className="min-w-0">
                      <Waves className="mx-auto h-4 w-4 text-cyan-300" />
                      <div className="mt-0.5 text-[13px] font-semibold leading-none">{conditions.waterTemperature != null ? `${Math.round(conditions.waterTemperature)}°` : "—"}</div>
                      <div className="text-[10px] text-white/65">Water</div>
                    </div>
                    <div className="min-w-0">
                      <Wind className="mx-auto h-4 w-4 text-sky-300" />
                      <div className="mt-0.5 text-[13px] font-semibold leading-none">{Math.round(conditions.windSpeed)} mph</div>
                      <div className="text-[10px] text-white/65">{windDirLabel(conditions.windDirection) || "Wind"}</div>
                    </div>
                    <div className="min-w-0">
                      <Gauge className="mx-auto h-4 w-4 text-teal-300" />
                      <div className="mt-0.5 text-[13px] font-semibold leading-none">{conditions.waterLevel != null ? `${conditions.waterLevel.toFixed(1)}ft` : "—"}</div>
                      <div className="text-[10px] text-white/65">Lake Level</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full bg-white/20" />
                  <Skeleton className="h-7 w-16 bg-white/20" />
                  <Skeleton className="h-7 flex-1 bg-white/20" />
                </div>
              )}
            </button>
          </div>
        </div>

        <ConditionsDrawer conditions={conditions ?? null} open={conditionsOpen} onOpenChange={setConditionsOpen} />

        <SuggestedFriendsDrawer />

        {/* Stats + composer */}
        <div className="space-y-3 px-4 pt-4">
          {summary && (
            <div className="grid grid-cols-4 gap-2">
              <Link href="/map?presence=1" className="rounded-2xl border border-border bg-card p-2.5 hover-elevate active:scale-[0.98] transition-transform">
                <div className="mb-1 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <span className="truncate text-[10px] font-medium text-muted-foreground">Lake Active</span>
                </div>
                <div className="text-xl font-bold leading-none">{summary.activeUsersToday}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">Now on the water</div>
              </Link>
              <Link href="/catches" className="rounded-2xl border border-border bg-card p-2.5 hover-elevate active:scale-[0.98] transition-transform">
                <div className="mb-1 flex items-center gap-1">
                  <Fish className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate text-[10px] font-medium text-muted-foreground">Fishing</span>
                </div>
                <div className="text-xl font-bold leading-none">{summary.fishingReports ?? 0}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">Reports logged</div>
              </Link>
              <button type="button" onClick={() => setActiveTab("event")} className="rounded-2xl border border-border bg-card p-2.5 text-left hover-elevate active:scale-[0.98] transition-transform">
                <div className="mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate text-[10px] font-medium text-muted-foreground">Events</span>
                </div>
                <div className="text-xl font-bold leading-none">{summary.totalEvents}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">Upcoming</div>
              </button>
              <Link href="/map" className="rounded-2xl border border-border bg-card p-2.5 hover-elevate active:scale-[0.98] transition-transform">
                <div className="mb-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span className="truncate text-[10px] font-medium text-muted-foreground">Live Pins</span>
                </div>
                <div className="text-xl font-bold leading-none">{summary.totalPins}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">On the map</div>
              </Link>
            </div>
          )}

          {me && (
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <button
                type="button"
                onClick={() => { setNewType("post"); setComposerOpen(true); }}
                className="flex w-full items-center gap-3 text-left"
                aria-label="Create a new post"
              >
                <UserAvatar name={me.displayName || "You"} username={me.username || ""} avatarUrl={me.avatarUrl} className="h-9 w-9 shrink-0" />
                <span className="flex-1 truncate text-sm text-muted-foreground">What's happening on the lake?</span>
              </button>
              <div className="mt-3 grid grid-cols-4 gap-1 border-t border-border pt-2">
                <button type="button" onClick={() => { setNewType("post"); setComposerOpen(true); }} className="flex flex-col items-center gap-1 rounded-lg py-1.5 hover-elevate active:scale-95 transition">
                  <Camera className="h-[18px] w-[18px] text-sky-500" />
                  <span className="text-[11px] font-medium text-muted-foreground">Photo</span>
                </button>
                <Link href="/catches" className="flex flex-col items-center gap-1 rounded-lg py-1.5 hover-elevate active:scale-95 transition">
                  <Fish className="h-[18px] w-[18px] text-teal-500" />
                  <span className="text-[11px] font-medium text-muted-foreground">Catch</span>
                </Link>
                <Link href="/map" className="flex flex-col items-center gap-1 rounded-lg py-1.5 hover-elevate active:scale-95 transition">
                  <MapPin className="h-[18px] w-[18px] text-rose-500" />
                  <span className="text-[11px] font-medium text-muted-foreground">Drop Pin</span>
                </Link>
                <button type="button" onClick={() => { setNewType("event"); setComposerOpen(true); }} className="flex flex-col items-center gap-1 rounded-lg py-1.5 hover-elevate active:scale-95 transition">
                  <CalendarPlus className="h-[18px] w-[18px] text-violet-500" />
                  <span className="text-[11px] font-medium text-muted-foreground">Event</span>
                </button>
              </div>
            </div>
          )}

          <StoriesRow />

          <SuggestedFriendsButton />

          {conditions?.fishingPressure && (() => {
            const style = pressureStyles[conditions.fishingPressure.level] ?? pressureStyles.moderate;
            return (
              <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${style.wrap}`}>
                <Fish className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span><span className="font-semibold">Fishing pressure: {style.label}.</span> {conditions.fishingPressure.detail}</span>
              </div>
            );
          })()}

          {conditions?.advisories && conditions.advisories.length > 0 && (
            <div className="space-y-2">
              {conditions.advisories.map((a, i) => {
                const style = advisoryStyles[a.level] ?? advisoryStyles.good;
                const Icon = style.icon;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${style.wrap}`}>
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span><span className="font-semibold">{a.title}.</span> {a.detail}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter tabs: stick to the top once the hero scrolls away */}
        <div className="sticky top-0 z-10 mt-3 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center justify-center gap-5 overflow-x-auto no-scrollbar px-4">
            {([
              ["all", "All"],
              ["friends", "Friends"],
              ["community", "Community"],
              ["event", "Events"],
              ["trending", "Trending"],
              ["business", "Local"],
              ["saved", "Saved"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`relative shrink-0 py-3 text-sm font-medium transition-colors ${activeTab === value ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
                {activeTab === value && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
        <HazardBanner />
        {isTrendingTab ? (
          <TrendingSection />
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader className="flex flex-row items-center gap-4 p-4 pb-2">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : posts?.length ? (
          posts.map(post => (
            <div key={post.id} id={`post-${post.id}`}>
              <PostCard
                post={post}
                onReact={(reaction) => reactPost.mutate({ postId: post.id, data: { reaction } }, { onSuccess: refreshPosts })}
                canDelete={me != null && (post.userId === me.id || me.isAdmin)}
                onDelete={() => handleDeletePost(post.id)}
                onEdit={() => openEditPost(post)}
                currentUserId={me?.id}
                onOpen={() => setOpenPostId(post.id)}
              />
            </div>
          ))
        ) : (
          <div className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Nothing here yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Be the first to share what's happening on the lake. Use the box above to post.
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
              onReact={(reaction) => reactPost.mutate({ postId: openPost.id, data: { reaction } }, { onSuccess: refreshPosts })}
              canDelete={me != null && (openPost.userId === me.id || me.isAdmin)}
              onDelete={() => handleDeletePost(openPost.id)}
              onEdit={() => openEditPost(openPost)}
              currentUserId={me?.id}
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
          <DialogDescription className="sr-only">Share something with the Dale Hollow community.</DialogDescription>

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
                        <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Dale Hollow Community</span>
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

function ReactionButton({ post, onReact }: { post: any, onReact: (reaction: ReactionKey) => void }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);

  const current = post.myReaction ? REACTION_MAP[post.myReaction] : null;
  const counts: Record<string, number> = post.reactionCounts || {};
  const total = post.likeCount || 0;
  const topEmojis = REACTIONS.filter((r) => (counts[r.key] || 0) > 0)
    .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0))
    .slice(0, 3)
    .map((r) => r.emoji);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    longPressed.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressed.current = true;
      setPickerOpen(true);
    }, 350);
  };

  const handleClick = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onReact((post.myReaction as ReactionKey) || DEFAULT_REACTION);
  };

  const choose = (key: ReactionKey) => {
    setPickerOpen(false);
    longPressed.current = false;
    onReact(key);
  };

  React.useEffect(() => () => clearTimer(), []);

  return (
    <div className="relative flex-1">
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-50 flex gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-xl">
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => choose(r.key)}
                aria-label={r.label}
                title={r.label}
                className={`text-2xl leading-none transition-transform hover:scale-125 active:scale-110 ${post.myReaction === r.key ? "scale-110" : ""}`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={`w-full select-none text-muted-foreground ${current ? "text-primary font-medium" : ""}`}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
      >
        {current ? (
          <span className="mr-2 text-base leading-none">{current.emoji}</span>
        ) : topEmojis.length > 0 ? (
          <span className="mr-2 text-base leading-none">{topEmojis.join("")}</span>
        ) : (
          <Heart className="w-4 h-4 mr-2" />
        )}
        {total}
      </Button>
    </div>
  );
}

function CommentReactionButton({ comment, onReact }: { comment: any, onReact: (reaction: ReactionKey) => void }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);

  const current = comment.myReaction ? REACTION_MAP[comment.myReaction] : null;
  const counts: Record<string, number> = comment.reactionCounts || {};
  const total = comment.likeCount || 0;
  const topEmojis = REACTIONS.filter((r) => (counts[r.key] || 0) > 0)
    .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0))
    .slice(0, 3)
    .map((r) => r.emoji);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const startPress = () => {
    longPressed.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressed.current = true;
      setPickerOpen(true);
    }, 350);
  };
  const handleClick = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onReact((comment.myReaction as ReactionKey) || DEFAULT_REACTION);
  };
  const choose = (key: ReactionKey) => {
    setPickerOpen(false);
    longPressed.current = false;
    onReact(key);
  };
  React.useEffect(() => () => clearTimer(), []);

  return (
    <div className="relative inline-flex items-center">
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 flex gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 shadow-xl">
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => choose(r.key)}
                aria-label={r.label}
                title={r.label}
                className={`text-xl leading-none transition-transform hover:scale-125 active:scale-110 ${comment.myReaction === r.key ? "scale-110" : ""}`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        className={`inline-flex select-none items-center gap-1 text-xs font-medium transition-colors ${current ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        aria-label="Like comment"
      >
        {current ? (
          <span className="text-sm leading-none">{current.emoji}</span>
        ) : topEmojis.length > 0 ? (
          <span className="text-sm leading-none">{topEmojis.join("")}</span>
        ) : (
          <Heart className="w-3.5 h-3.5" />
        )}
        <span>{current ? current.label : "Like"}{total > 0 ? ` · ${total}` : ""}</span>
      </button>
    </div>
  );
}

function LikesDialog({ postId, open, onOpenChange }: { postId: number, open: boolean, onOpenChange: (v: boolean) => void }) {
  const { data: likes, isLoading } = useGetPostLikes(postId, { query: { enabled: open } });
  const [filter, setFilter] = React.useState<ReactionKey | "all">("all");
  React.useEffect(() => { if (!open) setFilter("all"); }, [open]);

  const counts: Record<string, number> = {};
  for (const l of likes ?? []) counts[l.reaction] = (counts[l.reaction] || 0) + 1;
  const total = likes?.length ?? 0;
  const available = REACTIONS.filter((r) => (counts[r.key] || 0) > 0);
  React.useEffect(() => {
    if (filter !== "all" && !available.some((r) => r.key === filter)) setFilter("all");
  }, [filter, available]);
  const filtered = filter === "all" ? (likes ?? []) : (likes ?? []).filter((l) => l.reaction === filter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reactions</DialogTitle>
          <DialogDescription className="sr-only">People who reacted to this post</DialogDescription>
        </DialogHeader>
        {total > 0 && (
          <div className="flex items-center gap-4 overflow-x-auto border-b border-border/60 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`shrink-0 pb-2 text-sm font-semibold border-b-2 transition-colors ${filter === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              All {total}
            </button>
            {available.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setFilter(r.key)}
                aria-label={`${r.label} ${counts[r.key]}`}
                className={`shrink-0 pb-2 flex items-center gap-1.5 text-sm font-semibold border-b-2 transition-colors ${filter === r.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <span className="text-base leading-none">{r.emoji}</span>
                <span>{counts[r.key]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="max-h-80 overflow-y-auto -mx-2">
          {isLoading ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length > 0 ? (
            filtered.map((l) => (
              <div key={l.userId} className="flex items-center gap-3 px-2 py-2">
                <div className="relative shrink-0">
                  <UserAvatar name={l.user?.displayName || "User"} username={l.user?.username || ""} avatarUrl={l.user?.avatarUrl} className="w-9 h-9" />
                  <span className="absolute -bottom-1 -right-1 text-sm leading-none">{REACTION_MAP[l.reaction]?.emoji || "❤️"}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.user?.displayName || "User"}</p>
                  {l.user?.username && <p className="truncate text-xs text-muted-foreground">@{l.user.username}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No reactions yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PostCard({ post, onReact, canDelete, onDelete, onEdit, currentUserId, onOpen }: { post: any, onReact: (reaction: ReactionKey) => void, canDelete?: boolean, onDelete?: () => void, onEdit?: () => void, currentUserId?: number, onOpen?: () => void }) {
  const isEvent = post.postType === "event";
  const isTieUp = post.postType === "tie_up";
  const isGathering = isEvent || isTieUp;
  const isBoat = post.postType === "boat_showcase";
  const boatPhotos: string[] = Array.isArray(post.photos) && post.photos.length ? post.photos : (post.imageUrl ? [post.imageUrl] : []);
  const boatSpecs: { label: string; value: string }[] = [];
  if (isBoat) {
    if (post.engineSetup) boatSpecs.push({ label: "Engine", value: String(post.engineSetup) });
    if (post.horsepower != null) boatSpecs.push({ label: "Horsepower", value: `${post.horsepower} HP` });
    if (post.topSpeed != null) boatSpecs.push({ label: "Top speed", value: `${post.topSpeed} mph` });
    if (post.mods) boatSpecs.push({ label: "Mods", value: String(post.mods) });
  }
  const [showComments, setShowComments] = React.useState(false);
  const [showLikes, setShowLikes] = React.useState(false);
  const likeTotal = post.likeCount || 0;
  const likeReactionCounts: Record<string, number> = post.reactionCounts || {};
  const topLikeEmojis = REACTIONS.filter((r) => (likeReactionCounts[r.key] || 0) > 0)
    .sort((a, b) => (likeReactionCounts[b.key] || 0) - (likeReactionCounts[a.key] || 0))
    .slice(0, 3)
    .map((r) => r.emoji);
  const { data: comments } = useGetPostComments(post.id, { query: { enabled: showComments } });
  const createComment = useCreatePostComment();
  const deleteComment = useDeletePostComment();
  const toggleRsvp = useToggleRsvp();
  const reactToComment = useReactToComment();
  const queryClient = useQueryClient();
  const savePost = useSavePost();
  const unsavePost = useUnsavePost();
  const muteUser = useMuteUser();
  const blockUser = useBlockUser();
  const shareToProfile = useShareToProfile();
  const [reportOpen, setReportOpen] = React.useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = React.useState(false);
  const isOwnPost = currentUserId != null && post.userId === currentUserId;

  const handleShareExternal = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}feed?post=${post.id}`;
    const title = post.title || post.user?.displayName || "Gillie post";
    if (navigator.share) {
      try {
        await navigator.share({ title, text: post.content || title, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Couldn't share this post.");
    }
  };

  const handleShareToProfile = () => {
    shareToProfile.mutate(
      { postId: post.id, data: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          toast.success("Shared to your profile.");
        },
        onError: () => toast.error("Couldn't share to your profile."),
      }
    );
  };

  const handleToggleSave = () => {
    const mutation = post.savedByMe ? unsavePost : savePost;
    mutation.mutate(
      { postId: post.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSavedPostsQueryKey() });
          toast.success(post.savedByMe ? "Removed from saved." : "Post saved.");
        },
        onError: () => toast.error("Couldn't update saved posts."),
      }
    );
  };

  const handleMute = () => {
    muteUser.mutate(
      { userId: post.userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          toast.success(`You won't see ${post.user?.displayName || "this user"}'s posts anymore.`);
        },
        onError: () => toast.error("Couldn't hide that user's posts."),
      }
    );
  };

  const handleBlock = () => {
    blockUser.mutate(
      { userId: post.userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBlockedUsersQueryKey() });
          setBlockConfirmOpen(false);
          toast.success(`Blocked ${post.user?.displayName || "user"}.`);
        },
        onError: () => toast.error("Couldn't block that user."),
      }
    );
  };

  const handleRsvp = () => {
    toggleRsvp.mutate(
      { postId: post.id },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() }),
        onError: () => toast.error("Couldn't update your RSVP."),
      }
    );
  };
  const [commentText, setCommentText] = React.useState("");
  const [commentImageUrl, setCommentImageUrl] = React.useState<string | null>(null);
  const [commentVideoUrl, setCommentVideoUrl] = React.useState<string | null>(null);
  const commentImageInputRef = React.useRef<HTMLInputElement>(null);
  const commentVideoInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadFile: uploadCommentFile, isUploading: isUploadingComment } = useUpload();

  const refreshComments = () => {
    queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(post.id) });
  };

  const handleCommentImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo.");
      return;
    }
    try {
      const compressed = await compressImage(file);
      const res = await uploadCommentFile(compressed);
      if (res?.objectPath) {
        setCommentImageUrl(res.objectPath);
        setCommentVideoUrl(null);
        if (commentVideoInputRef.current) commentVideoInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that photo.");
      }
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  };

  const handleCommentVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    try {
      const res = await uploadCommentFile(file);
      if (res?.objectPath) {
        setCommentVideoUrl(res.objectPath);
        setCommentImageUrl(null);
        if (commentImageInputRef.current) commentImageInputRef.current.value = "";
      } else {
        toast.error("Couldn't upload that video.");
      }
    } catch {
      toast.error("Couldn't upload that video.");
    }
  };

  const submitComment = () => {
    if (!commentText.trim() && !commentImageUrl && !commentVideoUrl) return;
    createComment.mutate(
      {
        postId: post.id,
        data: {
          content: commentText.trim() || undefined,
          imageUrl: commentImageUrl ? `/api/storage${commentImageUrl}` : undefined,
          videoUrl: commentVideoUrl ? `/api/storage${commentVideoUrl}` : undefined,
        },
      },
      {
        onSuccess: () => {
          setCommentText("");
          setCommentImageUrl(null);
          setCommentVideoUrl(null);
          if (commentImageInputRef.current) commentImageInputRef.current.value = "";
          if (commentVideoInputRef.current) commentVideoInputRef.current.value = "";
          refreshComments();
        },
        onError: () => toast.error("Couldn't post your comment."),
      }
    );
  };

  const removeComment = (commentId: number) => {
    deleteComment.mutate(
      { postId: post.id, commentId },
      { onSuccess: refreshComments, onError: () => toast.error("Couldn't delete that comment.") }
    );
  };

  const handleReactComment = (commentId: number, reaction: ReactionKey) => {
    reactToComment.mutate(
      { postId: post.id, commentId, data: { reaction } },
      { onSuccess: refreshComments, onError: () => toast.error("Couldn't react to that comment.") }
    );
  };

  const commentCount = comments?.length ?? 0;

  return (
    <>
    <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" targetId={post.id} />
    <Card className="border-border/60 hover-elevate overflow-hidden bg-card">
      <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
        <Link href={`/profile/${post.userId}`} className="shrink-0">
          <UserAvatar name={post.user?.displayName || "User"} username={post.user?.username || ""} avatarUrl={post.user?.avatarUrl} className="w-10 h-10 cursor-pointer" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <Link href={`/profile/${post.userId}`}>
              <h3 className="font-semibold text-sm truncate hover:underline cursor-pointer">{post.user?.displayName}</h3>
            </Link>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </span>
              {canDelete && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                      <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" data-testid={`button-post-menu-${post.id}`}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {canDelete && onEdit && (
                    <DropdownMenuItem onClick={onEdit} data-testid={`menu-edit-${post.id}`}>
                      <Pencil className="w-4 h-4" />
                      Edit Post
                    </DropdownMenuItem>
                  )}
                  {!isOwnPost && (
                    <DropdownMenuItem onClick={() => setReportOpen(true)} data-testid={`menu-report-${post.id}`}>
                      <Flag className="w-4 h-4" />
                      Report Post
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleShareToProfile}>
                    <Repeat2 className="w-4 h-4" />
                    Share to your profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareExternal}>
                    <Share2 className="w-4 h-4" />
                    Share to other apps
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleSave}>
                    {post.savedByMe ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    {post.savedByMe ? "Unsave" : "Save"}
                  </DropdownMenuItem>
                  {!isOwnPost && (
                    <DropdownMenuItem onClick={handleMute}>
                      <EyeOff className="w-4 h-4" />
                      Hide Posts
                    </DropdownMenuItem>
                  )}
                  {!isOwnPost && (
                    <DropdownMenuItem onClick={() => setBlockConfirmOpen(true)} className="text-destructive focus:text-destructive">
                      <Ban className="w-4 h-4" />
                      Block User
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Block {post.user?.displayName || "this user"}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Blocked users will no longer be able to view your location or interact with you. You can unblock them later from Settings.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBlock} disabled={blockUser.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Block
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {post.user?.boatName && <p className="text-xs text-muted-foreground truncate">{post.user.boatName}</p>}
        </div>
      </CardHeader>
      
      <CardContent
        className={`p-4 pt-2${onOpen ? " cursor-pointer" : ""}`}
        onClick={onOpen ? (e) => {
          if ((e.target as HTMLElement).closest('a, button, video, input, textarea')) return;
          onOpen();
        } : undefined}
      >
        <MatureGate isMature={post.isMature} label="Sensitive post">
        {post.sharedPostId && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
            <Repeat2 className="w-3.5 h-3.5" />
            Shared a post
          </div>
        )}
        {isTieUp && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-600 bg-teal-500/10 px-2 py-1 rounded-full mb-2">
            <Anchor className="w-3.5 h-3.5" />
            Tie-up
          </div>
        )}
        {isBoat && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-600 bg-sky-500/10 px-2 py-1 rounded-full mb-2">
            <Sailboat className="w-3.5 h-3.5" />
            Boat Showcase
          </div>
        )}
        {post.title && <h4 className="font-bold text-lg mb-1">{post.title}</h4>}
        
        {isGathering && post.eventDate && (
          <div className="flex items-center gap-2 text-sm text-accent-foreground bg-accent/20 px-3 py-2 rounded-md mb-3 font-medium">
            <Calendar className="w-4 h-4 text-accent" />
            {new Date(post.eventDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        )}

        {isGathering && (
          <div className="flex items-center gap-3 mb-3">
            <Button
              type="button"
              size="sm"
              variant={post.rsvpByMe ? "default" : "outline"}
              onClick={handleRsvp}
              disabled={toggleRsvp.isPending}
            >
              {post.rsvpByMe ? <Check className="w-4 h-4 mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
              {post.rsvpByMe ? "Going" : "RSVP"}
            </Button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {post.rsvpCount || 0} going
            </span>
          </div>
        )}
        
        {post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>}

        {post.poll && <PollView post={post} />}

        {post.sharedPostId ? (
          post.sharedPost ? (
            <Link href={`/feed?post=${post.sharedPost.id}`} className="block mt-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 hover-elevate">
                <div className="flex items-center gap-2 mb-1.5">
                  <UserAvatar name={post.sharedPost.user?.displayName || "User"} username={post.sharedPost.user?.username || ""} avatarUrl={post.sharedPost.user?.avatarUrl} className="w-6 h-6" />
                  <span className="font-semibold text-xs truncate">{post.sharedPost.user?.displayName}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(post.sharedPost.createdAt), { addSuffix: true })}</span>
                </div>
                {post.sharedPost.title && <h4 className="font-bold text-sm mb-0.5">{post.sharedPost.title}</h4>}
                {post.sharedPost.content && <p className="text-sm whitespace-pre-wrap line-clamp-6">{post.sharedPost.content}</p>}
                {post.sharedPost.imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden bg-muted relative aspect-video">
                    <img src={resolveImageSrc(post.sharedPost.imageUrl)} alt="Shared post" className="object-cover w-full h-full" />
                  </div>
                )}
                {post.sharedPost.videoUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden bg-black relative aspect-video">
                    <video src={post.sharedPost.videoUrl} controls className="w-full h-full" />
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground text-center">
              This post is no longer available.
            </div>
          )
        ) : isBoat ? (
          <>
            {boatPhotos.length > 0 && (
              boatPhotos.length === 1 ? (
                <div className="mt-3 rounded-xl overflow-hidden bg-muted relative aspect-video">
                  <ClickableImage src={resolveImageSrc(boatPhotos[0])} alt="Boat" className="object-cover w-full h-full" />
                </div>
              ) : (
                <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1 snap-x">
                  {boatPhotos.map((url, i) => (
                    <div key={`${url}-${i}`} className="shrink-0 w-3/4 snap-start rounded-xl overflow-hidden bg-muted relative aspect-video">
                      <ClickableImage src={resolveImageSrc(url)} alt={`Boat ${i + 1}`} className="object-cover w-full h-full" />
                    </div>
                  ))}
                </div>
              )
            )}

            {boatSpecs.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {boatSpecs.map((spec) => (
                  <div key={spec.label} className={`rounded-lg border border-border/60 bg-muted/30 px-3 py-2 ${spec.label === "Engine" || spec.label === "Mods" ? "col-span-2" : ""}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{spec.label}</div>
                    <div className="text-sm font-medium">{spec.value}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {post.imageUrl && (
              <div className="mt-3 rounded-xl overflow-hidden bg-muted relative aspect-video">
                <ClickableImage src={resolveImageSrc(post.imageUrl)} alt="Post content" className="object-cover w-full h-full" />
              </div>
            )}

            {post.videoUrl && (
              <div className="mt-3 rounded-xl overflow-hidden bg-black relative aspect-video">
                <video src={post.videoUrl} controls className="w-full h-full" />
              </div>
            )}
          </>
        )}
        </MatureGate>
      </CardContent>

      {likeTotal > 0 && (
        <button
          type="button"
          onClick={() => setShowLikes(true)}
          className="flex items-center gap-1.5 px-4 pb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          data-testid={`button-view-likes-${post.id}`}
        >
          {topLikeEmojis.length > 0 && <span className="text-sm leading-none">{topLikeEmojis.join("")}</span>}
          <span>{likeTotal} {likeTotal === 1 ? "like" : "likes"}</span>
        </button>
      )}
      <LikesDialog postId={post.id} open={showLikes} onOpenChange={setShowLikes} />

      <CardFooter className="p-2 border-t border-border/40 flex justify-between bg-muted/10">
        <ReactionButton post={post} onReact={onReact} />
        <Button variant="ghost" size="sm" className={`flex-1 text-muted-foreground ${showComments ? 'text-primary' : ''}`} onClick={() => setShowComments(v => !v)}>
          <MessageCircle className="w-4 h-4 mr-2" /> {commentCount > 0 ? commentCount : "Comment"}
        </Button>
        {post.pinLat != null && post.pinLng != null && (
          <Button asChild variant="ghost" size="sm" className="flex-1 text-primary">
            <Link href={`/map?lat=${post.pinLat}&lng=${post.pinLng}`}>
              <MapPin className="w-4 h-4 mr-2" /> Map
            </Link>
          </Button>
        )}
      </CardFooter>

      {showComments && (
        <div className="border-t border-border/40 bg-muted/5 p-4 space-y-3">
          {comments && comments.length > 0 ? (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 group">
                <Link href={`/profile/${c.userId}`} className="shrink-0">
                  <UserAvatar name={c.user?.displayName || "User"} username={c.user?.username || ""} avatarUrl={c.user?.avatarUrl} className="w-7 h-7 mt-0.5 cursor-pointer" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="bg-muted rounded-2xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${c.userId}`}>
                        <span className="font-semibold text-xs hover:underline cursor-pointer">{c.user?.displayName || "User"}</span>
                      </Link>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                    </div>
                    <MatureGate isMature={c.isMature} label="Sensitive comment">
                    {c.content && <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>}
                    {c.imageUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden bg-muted">
                        <ClickableImage src={c.imageUrl} alt="Comment attachment" className="w-full h-auto" />
                      </div>
                    )}
                    {c.videoUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden bg-black aspect-video">
                        <video src={c.videoUrl} controls className="w-full h-full" />
                      </div>
                    )}
                    </MatureGate>
                  </div>
                  <div className="mt-1 pl-3">
                    <CommentReactionButton comment={c} onReact={(r) => handleReactComment(c.id, r)} />
                  </div>
                </div>
                {currentUserId != null && c.userId === currentUserId && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeComment(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first to say something.</p>
          )}

          {commentImageUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted">
              <img src={`/api/storage${commentImageUrl}`} alt="Comment attachment" className="w-full h-auto" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => { setCommentImageUrl(null); if (commentImageInputRef.current) commentImageInputRef.current.value = ""; }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {commentVideoUrl && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video src={`/api/storage${commentVideoUrl}`} controls className="w-full h-full" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => { setCommentVideoUrl(null); if (commentVideoInputRef.current) commentVideoInputRef.current.value = ""; }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input ref={commentImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCommentImageSelect} />
            <input ref={commentVideoInputRef} type="file" accept="video/*" className="hidden" onChange={handleCommentVideoSelect} />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full shrink-0"
              disabled={isUploadingComment}
              onClick={() => commentImageInputRef.current?.click()}
              title="Add a photo"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full shrink-0"
              disabled={isUploadingComment}
              onClick={() => commentVideoInputRef.current?.click()}
              title="Add a video"
            >
              <Video className="w-4 h-4" />
            </Button>
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitComment(); } }}
              placeholder={isUploadingComment ? "Uploading..." : "Add a comment..."}
              className="rounded-full"
            />
            <Button size="icon" className="rounded-full shrink-0" onClick={submitComment} disabled={(!commentText.trim() && !commentImageUrl && !commentVideoUrl) || createComment.isPending || isUploadingComment}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
    </>
  );
}
