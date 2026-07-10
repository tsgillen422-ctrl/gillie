import React from "react";
import { useRoute, useLocation, Link } from "wouter";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  Store,
  Phone,
  Globe,
  Clock,
  MapPin,
  Navigation,
  Flag,
  Pencil,
  BadgeCheck,
  MessageSquare,
  Star,
  Users,
  Calendar,
  Plus,
  Trash2,
  Heart,
  Bookmark,
  BookmarkCheck,
  Palette,
  MoreHorizontal
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBusiness,
  useGetMe,
  useCreateReport,
  useFollowBusiness,
  useUnfollowBusiness,
  useSaveBusiness,
  useUnsaveBusiness,
  useGetBusinessReviews,
  useUpsertBusinessReview,
  useDeleteBusinessReview,
  useGetBusinessPosts,
  useReactToPost,
  useDeletePost,
  getGetBusinessQueryKey,
  getGetBusinessReviewsQueryKey,
  getGetBusinessPostsQueryKey,
} from "@workspace/api-client-react";
import type { BusinessReview, Post } from "@workspace/api-client-react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { ClickableImage } from "@/components/ClickableImage";
import { MatureGate } from "@/components/MatureGate";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useToast } from "@/hooks/use-toast";
import { PostCard } from "@/components/feed/PostCard";
import { ConditionsWidget } from "@/components/ConditionsWidget";
import { getAmenityIcon, getAmenityLabel, getHighlightIcon } from "@/lib/business-meta";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const PROFILE_TAB =
  "shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-soft data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft";

function WaveDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`-mx-4 text-primary/15 ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="w-full h-4">
        <path
          fill="currentColor"
          d="M0,24 C180,46 360,4 540,18 C720,32 900,48 1080,30 C1260,14 1350,20 1440,28 L1440,48 L0,48 Z"
        />
      </svg>
    </div>
  );
}

function StarRow({ value, onChange, size = "w-4 h-4" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "p-0.5 active:scale-90 transition" : "cursor-default"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!ref.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: MAP_STYLE,
        center: [lng, lat],
        zoom: 13,
        interactive: false,
        attributionControl: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    const marker = new maplibregl.Marker({ color: "#0d9488" }).setLngLat([lng, lat]).addTo(map);
    return () => {
      marker.remove();
      map.remove();
    };
  }, [lat, lng]);
  if (failed) return null;
  return <div ref={ref} className="h-40 w-full rounded-2xl overflow-hidden border border-border" data-testid="business-mini-map" />;
}

const WEEK_DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

/** Great-circle distance in miles between two lat/lng points. */
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** "14:30" -> "2:30 PM" */
function formatTime(t: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

/** Convert "#rgb" / "#rrggbb" to an HSL triplet string ("H S% L%") for the --primary CSS var. */
function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

export default function BusinessDetailPage() {
  const [, params] = useRoute("/businesses/:businessId");
  const [, navigate] = useLocation();
  const businessId = Number(params?.businessId);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: me } = useGetMe();
  const { data: business, isLoading, error } = useGetBusiness(businessId, {
    query: { queryKey: getGetBusinessQueryKey(businessId), enabled: Number.isFinite(businessId) },
  });
  const { data: reviews = [] } = useGetBusinessReviews(businessId, {
    query: { queryKey: getGetBusinessReviewsQueryKey(businessId), enabled: Number.isFinite(businessId) },
  });
  const { data: posts = [] } = useGetBusinessPosts(businessId, {
    query: { queryKey: getGetBusinessPostsQueryKey(businessId), enabled: Number.isFinite(businessId) },
  });

  const submitReport = useCreateReport();
  const follow = useFollowBusiness();
  const unfollow = useUnfollowBusiness();
  const saveAction = useSaveBusiness();
  const unsaveAction = useUnsaveBusiness();
  const upsertReview = useUpsertBusinessReview();
  const deleteReview = useDeleteBusinessReview();

  const [reportOpen, setReportOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [details, setDetails] = React.useState("");

  const [reportReviewId, setReportReviewId] = React.useState<number | null>(null);
  const [reviewReason, setReviewReason] = React.useState<string>("");
  const [reviewDetails, setReviewDetails] = React.useState("");

  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [reviewText, setReviewText] = React.useState("");

  const [lightboxOpen, setLightboxOpen] = React.useState<{ src: string; alt: string } | null>(null);
  const [activeTab, setActiveTab] = React.useState("updates");

  const isOwner = me != null && business != null && business.userId === me.id;
  const distanceAway =
    business?.lat != null && business?.lng != null && me?.currentLat != null && me?.currentLng != null
      ? distanceMiles(me.currentLat, me.currentLng, business.lat, business.lng)
      : null;
  const myReview = React.useMemo(
    () => (me ? reviews.find((r: BusinessReview) => r.userId === me.id) : undefined),
    [reviews, me],
  );

  const reactPost = useReactToPost();
  const deletePost = useDeletePost();

  const invalidateBusiness = () => {
    qc.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
  };

  const refreshPosts = () => {
    qc.invalidateQueries({ queryKey: getGetBusinessPostsQueryKey(businessId) });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !business) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="font-semibold">Business not found</p>
        <Button variant="outline" onClick={() => navigate("/businesses")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Businesses
        </Button>
      </div>
    );
  }

  const followedByMe = business.followedByMe ?? false;
  const savedByMe = business.savedByMe ?? false;
  const followerCount = business.followerCount ?? 0;
  const avgRating = business.avgRating ?? 0;
  const reviewCount = business.reviewCount ?? reviews.length;

  const toggleFollow = () => {
    const m = followedByMe ? unfollow : follow;
    m.mutate(
      { businessId: business.id },
      {
        onSuccess: () => invalidateBusiness(),
        onError: () => toast({ title: followedByMe ? "Could not unfollow" : "Could not follow", variant: "destructive" }),
      },
    );
  };

  const toggleSave = () => {
    const m = savedByMe ? unsaveAction : saveAction;
    m.mutate(
      { businessId: business.id },
      {
        onSuccess: () => {
          invalidateBusiness();
          toast({ title: savedByMe ? "Removed from saved" : "Saved to your list" });
        },
        onError: () => toast({ title: "Could not save", variant: "destructive" }),
      },
    );
  };

  const openReview = () => {
    setRating(myReview?.rating ?? 0);
    setReviewText(myReview?.content ?? "");
    setReviewOpen(true);
  };

  const saveReview = () => {
    if (rating < 1) {
      toast({ title: "Pick a star rating", variant: "destructive" });
      return;
    }
    upsertReview.mutate(
      { businessId: business.id, data: { rating, content: reviewText.trim() || null } },
      {
        onSuccess: () => {
          setReviewOpen(false);
          qc.invalidateQueries({ queryKey: getGetBusinessReviewsQueryKey(businessId) });
          invalidateBusiness();
          toast({ title: myReview ? "Review updated" : "Review posted" });
        },
        onError: () => toast({ title: "Could not save review", variant: "destructive" }),
      },
    );
  };

  const removeReview = () => {
    deleteReview.mutate(
      { businessId: business.id },
      {
        onSuccess: () => {
          setReviewOpen(false);
          qc.invalidateQueries({ queryKey: getGetBusinessReviewsQueryKey(businessId) });
          invalidateBusiness();
          toast({ title: "Review removed" });
        },
        onError: () => toast({ title: "Could not remove review", variant: "destructive" }),
      },
    );
  };

  const handleReport = () => {
    if (!reason) return;
    submitReport.mutate(
      { data: { targetType: "business" as any, targetId: business.id, reason: reason as any, details: details.trim() || undefined } },
      {
        onSuccess: () => {
          setReportOpen(false);
          setReason("");
          setDetails("");
          toast({ title: "Report submitted", description: "Thanks — our moderators will take a look." });
        },
        onError: () => toast({ title: "Could not submit report", variant: "destructive" }),
      },
    );
  };

  const handleReportReview = () => {
    if (reportReviewId == null || !reviewReason) return;
    submitReport.mutate(
      { data: { targetType: "review" as any, targetId: reportReviewId, reason: reviewReason as any, details: reviewDetails.trim() || undefined } },
      {
        onSuccess: () => {
          setReportReviewId(null);
          setReviewReason("");
          setReviewDetails("");
          toast({ title: "Report submitted", description: "Thanks — our moderators will take a look." });
        },
        onError: () => toast({ title: "Could not submit report", variant: "destructive" }),
      },
    );
  };

  const website = business.website
    ? business.website.startsWith("http")
      ? business.website
      : `https://${business.website}`
    : null;

  const themeTriplet = business.themeColor ? hexToHslTriplet(business.themeColor) : null;
  const themeStyle = themeTriplet ? ({ "--primary": themeTriplet } as React.CSSProperties) : undefined;

  let openStatus = "Unknown";
  let openStatusColor = "text-muted-foreground";
  if (business.hoursStructured) {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const now = new Date();
    const today = days[now.getDay()];
    const hours = (business.hoursStructured as any)[today];
    if (hours === null) {
      openStatus = "Closed Today";
      openStatusColor = "text-red-500";
    } else if (hours?.open && hours?.close) {
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM
      if (timeStr >= hours.open && timeStr <= hours.close) {
        openStatus = `Open · Closes at ${hours.close}`;
        openStatusColor = "text-emerald-500";
      } else {
        openStatus = `Closed · Opens at ${hours.open}`;
        openStatusColor = "text-red-500";
      }
    }
  } else if (business.hours) {
    openStatus = business.hours;
  }

  const events = posts.filter((p: Post) => p.postType === "event");

  return (
    <div className="h-full overflow-y-auto" style={themeStyle}>
      <div className="mx-auto w-full max-w-2xl pb-24">
        {/* Cover */}
        <div className="relative">
          <div className="h-56 w-full bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5">
            {business.coverUrl && <img src={business.coverUrl} alt="" className="h-full w-full object-cover" />}
          </div>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/businesses"))}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm shadow-sm"
            data-testid="button-back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {isOwner && (
              <Button size="sm" variant="secondary" className="backdrop-blur-sm rounded-full bg-white/90 shadow-sm" asChild>
                <Link href={`/businesses/customize?id=${business.id}`}><Palette className="w-4 h-4 mr-1.5" />Customize</Link>
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full bg-white/90 backdrop-blur-sm shadow-sm"
              onClick={toggleSave}
            >
              {savedByMe ? <Heart className="w-5 h-5 fill-rose-500 text-rose-500" /> : <Heart className="w-5 h-5 text-foreground" />}
            </Button>
          </div>
          {/* Logo */}
          <div className="absolute -bottom-12 left-4">
            {business.logoUrl ? (
              <img src={business.logoUrl} alt="" className="h-24 w-24 rounded-full object-cover border-4 border-background shadow-md bg-card" data-testid="business-logo" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center border-4 border-background shadow-md">
                <Store className="w-10 h-10" />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-14 space-y-5">
          {business.status !== "approved" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {business.status === "pending"
                ? "Pending Review — this profile is only visible to you and admins until it's approved."
                : "This profile was not approved. Edit and resubmit for review."}
            </div>
          )}

          {/* Name + stats */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold font-display leading-tight flex items-center gap-1.5" data-testid="business-name">
                  <span className="truncate">{business.businessName}</span>
                  {business.verified && <BadgeCheck className="w-5 h-5 text-primary shrink-0" data-testid="badge-verified" />}
                </h1>
                <p className="text-sm text-muted-foreground">{business.businessType}</p>
              </div>
              {!isOwner && business.status === "approved" && (
                <Button
                  size="sm"
                  variant={followedByMe ? "outline" : "default"}
                  onClick={toggleFollow}
                  disabled={follow.isPending || unfollow.isPending}
                  className="rounded-full shadow-sm"
                  data-testid="button-follow-business"
                >
                  {followedByMe ? "Following" : <><Plus className="w-4 h-4 mr-1" />Follow</>}
                </Button>
              )}
            </div>
            
            <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-2 text-sm">
              <span className={`font-medium flex items-center gap-1 ${openStatusColor}`}>
                <Clock className="w-4 h-4" /> {openStatus}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-4 h-4" /> <span className="font-semibold text-foreground">{followerCount}</span> followers
              </span>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground cursor-pointer hover:text-foreground">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                  ({reviewCount})
                </span>
              )}
            </div>
          </div>

          {/* Featured Banner */}
          {business.featured && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-xl font-bold text-[10px] uppercase tracking-wider">
                {business.featured.type.replace(/_/g, " ")}
              </div>
              <h3 className="font-bold text-lg text-primary pr-20">{business.featured.title}</h3>
              {business.featured.text && <p className="text-sm text-foreground/80 mt-1">{business.featured.text}</p>}
            </div>
          )}

          {/* Highlights Row */}
          {business.highlights && business.highlights.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
              {business.highlights.map((h: any) => {
                const Icon = getHighlightIcon(h.icon);
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="flex flex-col items-center gap-1.5 shrink-0 snap-center w-[72px]"
                    onClick={() => {
                      if (h.imageUrl) setLightboxOpen({ src: h.imageUrl, alt: h.label });
                    }}
                  >
                    <div className="w-[68px] h-[68px] rounded-full p-[2px] bg-gradient-to-tr from-primary to-primary/40">
                      <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden flex items-center justify-center">
                        {h.imageUrl ? (
                          <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-primary/70">
                            <Icon className="w-7 h-7" />
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-center truncate w-full">{h.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action Row */}
          <div className="grid grid-cols-4 gap-2">
            {business.phone ? (
              <a href={`tel:${business.phone}`} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 hover:bg-muted/50 transition-colors shadow-sm" data-testid="action-call">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Phone className="w-4 h-4" /></div>
                <span className="text-[11px] font-medium">Call</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 opacity-40">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Phone className="w-4 h-4" /></div>
                <span className="text-[11px] font-medium">Call</span>
              </div>
            )}
            {business.lat != null && business.lng != null ? (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${business.lat},${business.lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 hover:bg-muted/50 transition-colors shadow-sm"
                data-testid="action-directions"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Navigation className="w-4 h-4" /></div>
                <span className="text-[11px] font-medium">Directions</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 opacity-40">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Navigation className="w-4 h-4" /></div>
                <span className="text-[11px] font-medium">Directions</span>
              </div>
            )}
            {website ? (
              <a href={website} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 hover:bg-muted/50 transition-colors shadow-sm" data-testid="action-website">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Globe className="w-4 h-4" /></div>
                <span className="text-[11px] font-medium">Website</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 opacity-40">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Globe className="w-4 h-4" /></div>
                <span className="text-[11px] font-medium">Website</span>
              </div>
            )}
            <button onClick={openReview} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3 hover:bg-muted/50 transition-colors shadow-sm" data-testid="action-review">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Star className="w-4 h-4" /></div>
              <span className="text-[11px] font-medium">Review</span>
            </button>
          </div>

          {/* Quick info chips */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar" data-testid="business-info-chips">
            {distanceAway != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium shrink-0 shadow-sm" data-testid="chip-distance">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                {distanceAway < 0.2 ? "Nearby" : `${distanceAway.toFixed(distanceAway < 10 ? 1 : 0)} mi away`}
              </span>
            )}
            {(business.hoursStructured || business.hours) && (
              <button
                type="button"
                onClick={() => setActiveTab("about")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium shrink-0 shadow-sm hover:bg-muted/50 transition-colors"
                data-testid="chip-hours"
              >
                <Clock className="w-3.5 h-3.5 text-primary" /> Hours
              </button>
            )}
            {(business.amenities ?? []).map((k) => {
              const Icon = getAmenityIcon(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveTab("amenities")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium shrink-0 shadow-sm hover:bg-muted/50 transition-colors"
                  data-testid={`chip-amenity-${k}`}
                >
                  <Icon className="w-3.5 h-3.5 text-primary" /> {getAmenityLabel(k)}
                </button>
              );
            })}
          </div>

          <WaveDivider className="my-6" />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
              <TabsList className="flex w-max gap-2 bg-transparent p-0">
                <TabsTrigger value="updates" className={PROFILE_TAB}>Updates</TabsTrigger>
                <TabsTrigger value="events" className={PROFILE_TAB}>Events</TabsTrigger>
                <TabsTrigger value="photos" className={PROFILE_TAB}>Photos</TabsTrigger>
                <TabsTrigger value="amenities" className={PROFILE_TAB}>Amenities</TabsTrigger>
                <TabsTrigger value="reviews" className={PROFILE_TAB}>Reviews</TabsTrigger>
                <TabsTrigger value="about" className={PROFILE_TAB}>About</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="updates" className="space-y-4 pt-2">
              {posts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-3xl border border-border shadow-soft">
                  {isOwner ? "Share your first update — followers will see it in their feed." : "No updates yet."}
                </div>
              ) : (
                posts.map((p: Post) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={me?.id}
                    canDelete={isOwner}
                    onReact={(reaction: any) => reactPost.mutate({ postId: p.id, data: { reaction } }, { onSuccess: refreshPosts })}
                    onDelete={() => deletePost.mutate({ postId: p.id }, { onSuccess: refreshPosts })}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="events" className="space-y-4 pt-2">
              {events.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-3xl border border-border shadow-soft">
                  No upcoming events.
                </div>
              ) : (
                events.map((p: Post) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={me?.id}
                    canDelete={isOwner}
                    onReact={(reaction: any) => reactPost.mutate({ postId: p.id, data: { reaction } }, { onSuccess: refreshPosts })}
                    onDelete={() => deletePost.mutate({ postId: p.id }, { onSuccess: refreshPosts })}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="photos" className="pt-2">
              {business.photos.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-3xl border border-border shadow-soft">
                  No photos yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {business.photos.map((p, i) => (
                    <button key={i} onClick={() => setLightboxOpen({ src: p, alt: "Gallery photo" })} className="aspect-square w-full rounded-2xl overflow-hidden shadow-sm">
                      <img src={p} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="amenities" className="space-y-6 pt-2">
              {business.amenities && business.amenities.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {business.amenities.map(k => {
                    const Icon = getAmenityIcon(k);
                    return (
                      <div key={k} className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card shadow-soft">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-sm">{getAmenityLabel(k)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-12 text-center text-muted-foreground bg-muted/20 rounded-3xl border border-border shadow-soft">No amenities listed.</p>
              )}
              {business.products && business.products.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3">Products & Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {business.products.map((p, i) => (
                      <span key={i} className="inline-flex px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium shadow-soft">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4 pt-2">
              {!isOwner && (
                <Button className="w-full rounded-2xl shadow-soft" onClick={openReview} data-testid="button-write-review">
                  <Star className="w-4 h-4 mr-2 fill-current" />
                  {myReview ? "Edit your review" : "Write a review"}
                </Button>
              )}
              {reviews.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-3xl border border-border shadow-soft">No reviews yet.</div>
              ) : (
                reviews.map((r: BusinessReview) => (
                  <div key={r.id} className="rounded-3xl border border-border bg-card p-5 space-y-2 shadow-soft" data-testid={`review-${r.id}`}>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={r.user?.displayName || "User"}
                        username={r.user?.username || ""}
                        avatarUrl={r.user?.avatarUrl}
                        className="w-10 h-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{r.user?.displayName || "Lake member"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <StarRow value={r.rating} />
                      {me && r.userId !== me.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-muted-foreground" data-testid={`button-review-menu-${r.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setReviewReason("");
                                setReviewDetails("");
                                setReportReviewId(r.id);
                              }}
                              data-testid={`menu-report-review-${r.id}`}
                            >
                              <Flag className="w-4 h-4 mr-2" /> Report Review
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {r.content && <p className="text-sm whitespace-pre-wrap leading-relaxed mt-2 text-foreground/90">{r.content}</p>}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="about" className="space-y-6 pt-2">
              {business.description && (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{business.description}</p>
                </div>
              )}
              
              <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden divide-y divide-border">
                {business.phone && (
                  <a href={`tel:${business.phone}`} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
                    <Phone className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm font-medium">{business.phone}</span>
                  </a>
                )}
                {website && (
                  <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
                    <Globe className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{business.website}</span>
                  </a>
                )}
                {business.serviceArea && (
                  <div className="flex items-start gap-4 px-5 py-4">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">Service area: {business.serviceArea}</span>
                  </div>
                )}
              </div>

              {(business.hoursStructured || business.hours) && (
                <div className="rounded-3xl border border-border bg-card shadow-soft p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">Hours</h3>
                  </div>
                  {business.hoursStructured ? (
                    <div className="space-y-1.5">
                      {WEEK_DAYS.map(({ key, label }) => {
                        const h = (business.hoursStructured as any)[key];
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">
                              {h ? `${formatTime(h.open)} – ${formatTime(h.close)}` : "Closed"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">{business.hours}</p>
                  )}
                </div>
              )}

              {business.lat != null && business.lng != null && (
                <div className="rounded-3xl border border-border bg-card shadow-soft p-1.5">
                  <MiniMap lat={business.lat} lng={business.lng} />
                </div>
              )}
              
              <div className="rounded-3xl border border-border bg-card shadow-soft p-5">
                <ConditionsWidget lakeId={business.lakeId} />
              </div>

              {!isOwner && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground rounded-2xl"
                  onClick={() => setReportOpen(true)}
                  data-testid="button-report-business"
                >
                  <Flag className="w-4 h-4 mr-2" /> Report this business
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ImageLightbox
        src={lightboxOpen?.src || null}
        alt={lightboxOpen?.alt || ""}
        open={!!lightboxOpen}
        onClose={() => setLightboxOpen(null)}
      />

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review {business.businessName}</DialogTitle>
            <DialogDescription>Share your experience with the community.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center gap-2">
              <StarRow value={rating} onChange={setRating} size="w-8 h-8" />
              <span className="text-sm font-medium text-muted-foreground">Tap to rate</span>
            </div>
            <div className="space-y-2">
              <Label>Review (optional)</Label>
              <Textarea
                placeholder="What did you think?"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {myReview && (
              <Button type="button" variant="destructive" onClick={removeReview} disabled={deleteReview.isPending} className="sm:mr-auto">
                Delete Review
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveReview} disabled={upsertReview.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Business</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Reason</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="" disabled>Select a reason...</option>
                <option value="fake_listing">Fake or fraudulent listing</option>
                <option value="incorrect_information">Incorrect information</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Details (optional)</Label>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={handleReport} disabled={submitReport.isPending || !reason}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report review dialog */}
      <Dialog open={reportReviewId != null} onOpenChange={(open) => { if (!open) setReportReviewId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Review</DialogTitle>
            <DialogDescription>The review stays visible while our moderators take a look.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Reason</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                data-testid="select-review-report-reason"
              >
                <option value="" disabled>Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="false_information">False information</option>
                <option value="hate_speech">Hate speech</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Details (optional)</Label>
              <Textarea value={reviewDetails} onChange={(e) => setReviewDetails(e.target.value)} rows={3} data-testid="input-review-report-details" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportReviewId(null)}>Cancel</Button>
            <Button onClick={handleReportReview} disabled={submitReport.isPending || !reviewReason} data-testid="button-submit-review-report">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}