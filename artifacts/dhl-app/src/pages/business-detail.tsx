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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBusiness,
  useGetMe,
  useCreateReport,
  useFollowBusiness,
  useUnfollowBusiness,
  useGetBusinessReviews,
  useUpsertBusinessReview,
  useDeleteBusinessReview,
  useGetBusinessPosts,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { ClickableImage } from "@/components/ClickableImage";
import { MatureGate } from "@/components/MatureGate";
import { useToast } from "@/hooks/use-toast";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const REPORT_REASONS = [
  { value: "fake_listing", label: "Fake or fraudulent listing" },
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

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

function BusinessPostCard({ post }: { post: Post }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2" data-testid={`business-post-${post.id}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {post.postType === "event" ? (
          <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-100">
            <Calendar className="w-3 h-3 mr-1" />
            {post.eventDate ? format(new Date(post.eventDate), "MMM d, h:mm a") : "Event"}
          </Badge>
        ) : post.postType === "deal" ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Deal</Badge>
        ) : post.postType === "new_arrival" ? (
          <Badge variant="secondary" className="bg-teal-100 text-teal-700 hover:bg-teal-100">New Arrival</Badge>
        ) : post.postType === "check_in" ? (
          <Badge variant="secondary" className="bg-teal-100 text-teal-700 hover:bg-teal-100">Check-In</Badge>
        ) : null}
        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
      </div>
      <MatureGate isMature={post.isMature}>
        {post.title && <h3 className="font-semibold text-sm">{post.title}</h3>}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
        {(post.photos ?? []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(post.photos ?? []).map((p, i) => (
              <ClickableImage key={i} src={p} alt="" className="h-36 rounded-xl object-cover shrink-0" />
            ))}
          </div>
        )}
        {post.imageUrl && !(post.photos ?? []).length && (
          <ClickableImage src={post.imageUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />
        )}
      </MatureGate>
    </div>
  );
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
  const upsertReview = useUpsertBusinessReview();
  const deleteReview = useDeleteBusinessReview();

  const [reportOpen, setReportOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [details, setDetails] = React.useState("");

  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [reviewText, setReviewText] = React.useState("");

  const isOwner = me != null && business != null && business.userId === me.id;
  const myReview = React.useMemo(
    () => (me ? reviews.find((r: BusinessReview) => r.userId === me.id) : undefined),
    [reviews, me],
  );

  const invalidateBusiness = () => {
    qc.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
    qc.invalidateQueries({ queryKey: ["business", businessId] });
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

  const website = business.website
    ? business.website.startsWith("http")
      ? business.website
      : `https://${business.website}`
    : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl pb-24">
        {/* Cover */}
        <div className="relative">
          <div className="h-40 w-full bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5">
            {business.coverUrl && <img src={business.coverUrl} alt="" className="h-full w-full object-cover" />}
          </div>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/businesses"))}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            data-testid="button-back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {isOwner && (
            <div className="absolute right-3 top-3">
              <Button size="sm" variant="secondary" className="backdrop-blur-sm" asChild>
                <Link href="/businesses/me/edit"><Pencil className="w-4 h-4 mr-1.5" />Edit</Link>
              </Button>
            </div>
          )}
          {/* Logo */}
          <div className="absolute -bottom-9 left-4">
            {business.logoUrl ? (
              <img src={business.logoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover border-4 border-background shadow-md" data-testid="business-logo" />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border-4 border-background shadow-md">
                <Store className="w-8 h-8" />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-11 space-y-4">
          {business.status !== "approved" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {business.status === "pending"
                ? "Pending Review — this profile is only visible to you and admins until it's approved."
                : "This profile was not approved. Edit and resubmit for review."}
            </div>
          )}

          {/* Name + stats + follow */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight flex items-center gap-1.5" data-testid="business-name">
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
                  data-testid="button-follow-business"
                >
                  {followedByMe ? "Following" : <><Plus className="w-4 h-4 mr-1" />Follow</>}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground" data-testid="business-followers">
                <Users className="w-4 h-4" />
                <span className="font-semibold text-foreground">{followerCount}</span>
                {followerCount === 1 ? "follower" : "followers"}
              </span>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground" data-testid="business-rating">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                  ({reviewCount})
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {business.phone ? (
              <a href={`tel:${business.phone}`} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 hover:bg-muted/50 transition-colors" data-testid="action-call">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-medium">Call</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 opacity-40">
                <Phone className="w-4 h-4" />
                <span className="text-[11px] font-medium">Call</span>
              </div>
            )}
            {business.lat != null && business.lng != null ? (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${business.lat},${business.lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 hover:bg-muted/50 transition-colors"
                data-testid="action-directions"
              >
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-medium">Directions</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 opacity-40">
                <Navigation className="w-4 h-4" />
                <span className="text-[11px] font-medium">Directions</span>
              </div>
            )}
            {website ? (
              <a href={website} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 hover:bg-muted/50 transition-colors" data-testid="action-website">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-medium">Website</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 opacity-40">
                <Globe className="w-4 h-4" />
                <span className="text-[11px] font-medium">Website</span>
              </div>
            )}
            {!isOwner ? (
              <Link href={`/messages?user=${business.userId}`} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 hover:bg-muted/50 transition-colors" data-testid="action-message">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-medium">Message</span>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 opacity-40">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[11px] font-medium">Message</span>
              </div>
            )}
          </div>

          {isOwner && business.status === "approved" && (
            <Button className="w-full" onClick={() => navigate(`/feed?compose=1&type=announcement&businessId=${business.id}`)} data-testid="button-business-compose">
              <Plus className="w-4 h-4 mr-2" /> Post an update or event
            </Button>
          )}

          {/* Tabs */}
          <Tabs defaultValue="posts">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="posts" data-testid="tab-posts">Posts</TabsTrigger>
              <TabsTrigger value="gallery" data-testid="tab-gallery">Gallery</TabsTrigger>
              <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
              <TabsTrigger value="about" data-testid="tab-about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="space-y-3 pt-3">
              {posts.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {isOwner ? "Share your first update — followers will see it in their feed." : "No updates yet."}
                </p>
              ) : (
                posts.map((p: Post) => <BusinessPostCard key={p.id} post={p} />)
              )}
            </TabsContent>

            <TabsContent value="gallery" className="pt-3">
              {business.photos.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No photos yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {business.photos.map((p, i) => (
                    <ClickableImage key={i} src={p} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="space-y-3 pt-3">
              {!isOwner && (
                <Button variant="outline" className="w-full" onClick={openReview} data-testid="button-write-review">
                  <Star className="w-4 h-4 mr-2" />
                  {myReview ? "Edit your review" : "Write a review"}
                </Button>
              )}
              {reviews.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                reviews.map((r: BusinessReview) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-1.5" data-testid={`review-${r.id}`}>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={r.user?.displayName || "User"}
                        username={r.user?.username || ""}
                        avatarUrl={r.user?.avatarUrl}
                        className="w-8 h-8"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{r.user?.displayName || "Lake member"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <StarRow value={r.rating} />
                    </div>
                    {r.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.content}</p>}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="about" className="space-y-4 pt-3">
              {business.description && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{business.description}</p>
              )}
              <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {business.phone && (
                  <a href={`tel:${business.phone}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{business.phone}</span>
                  </a>
                )}
                {website && (
                  <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <Globe className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{business.website}</span>
                  </a>
                )}
                {business.hours && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm whitespace-pre-wrap">{business.hours}</span>
                  </div>
                )}
                {business.serviceArea && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">Service area: {business.serviceArea}</span>
                  </div>
                )}
              </div>
              {business.lat != null && business.lng != null && <MiniMap lat={business.lat} lng={business.lng} />}
              {!isOwner && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
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

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{myReview ? "Edit your review" : "Review " + business.businessName}</DialogTitle>
            <DialogDescription>Share your experience with other lake members.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-center py-1">
              <StarRow value={rating} onChange={setRating} size="w-8 h-8" />
            </div>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What was your experience like? (optional)"
              rows={4}
              maxLength={2000}
              data-testid="input-review-text"
            />
          </div>
          <DialogFooter className="gap-2">
            {myReview && (
              <Button variant="ghost" className="text-destructive hover:text-destructive mr-auto" onClick={removeReview} disabled={deleteReview.isPending}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button onClick={saveReview} disabled={upsertReview.isPending} data-testid="button-save-review">
              {upsertReview.isPending ? "Saving…" : "Post review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Report Business</DialogTitle>
            <DialogDescription>
              Report a fake, incorrect, or inappropriate listing. Our moderators will review it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger data-testid="select-report-reason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Details (optional)</Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else moderators should know…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason || submitReport.isPending}
              onClick={handleReport}
              data-testid="button-submit-report"
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
