import React from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetUser, useGetMe, useGetPosts, useGetPins, useGetGallery, useCreateGalleryItem, useDeleteGalleryItem, useReactToPost, useDeletePost, useFollowUser, useUnfollowUser, useBlockUser, useUnblockUser, useDeleteUser, useGetFriends, useGetFollowers, useGetFollowing, useGetUserFriends, useGetCatches, useGetFavoritePins, getGetUserQueryKey, getGetGalleryQueryKey, getGetPostsQueryKey, getGetFriendsQueryKey, getGetBlockedUsersQueryKey, getGetFollowersQueryKey, getGetFollowingQueryKey, getGetUserFriendsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { MatureGate } from "@/components/MatureGate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Ship, UserMinus, UserPlus, ArrowLeft, MessageSquare, BadgeCheck, Lock, Globe, Users, ImagePlus, Plus, Play, X, Clock, Ban, ShieldOff, Flag, Home, Briefcase, Cake, Heart, User2, Trash2, Fish, Tent, Anchor, Mountain, Waves, Camera, Image as ImageIcon, Bookmark, FileText, ChevronRight, Star } from "lucide-react";
import { INTEREST_MAP } from "@/lib/interests";
import { ReportDialog } from "@/components/ReportDialog";
import { BadgeRow, badgeMeta } from "@/components/Badges";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar, resolveAvatarUrl } from "@/components/UserAvatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PostCard } from "./feed";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { boatLabelFor, boatSvgFor } from "@/boats";

function pinEmoji(type: string) {
  switch (type) {
    case "fishing_spot": return "🎣";
    case "marina": return "⛵";
    case "waterfall": return "💧";
    case "cliff": return "🏔️";
    case "rope_swing": return "🪢";
    case "shallow_water": return "🏖️";
    case "tubing": return "🛟";
    case "skiing": return "🎿";
    case "houseboat": return "🛥️";
    case "divers": return "🤿";
    case "campsite": return "🏕️";
    case "hazard": return "⚠️";
    default: return "📍";
  }
}

function PinVisibility({ visibility }: { visibility?: string }) {
  if (visibility === "public") {
    return <Badge variant="secondary" className="gap-1 text-[10px]"><Globe className="w-3 h-3" /> Public</Badge>;
  }
  if (visibility === "community") {
    return <Badge variant="secondary" className="gap-1 text-[10px]"><Users className="w-3 h-3" /> Community</Badge>;
  }
  return <Badge variant="secondary" className="gap-1 text-[10px]"><Lock className="w-3 h-3" /> Friends</Badge>;
}

function formatBirthday(value?: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function pinWindow(startTime?: string | null, endTime?: string | null) {
  if (!startTime && !endTime) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (startTime && endTime) return `${fmt(startTime)} - ${fmt(endTime)}`;
  if (startTime) return `From ${fmt(startTime)}`;
  return `Until ${fmt(endTime!)}`;
}

/* ----------------------------- Modern profile UI ---------------------------- */

const CARD = "rounded-3xl border border-card-border bg-card shadow-soft";

/** Lake-inspired wave divider between sections. */
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

function SectionTitle({ icon: Icon, children, action }: { icon: any; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 px-0.5">
      <h3 className="text-[15px] font-bold flex items-center gap-2">
        <span className="grid place-items-center w-7 h-7 rounded-xl bg-primary/10 text-primary">
          <Icon className="w-4 h-4" />
        </span>
        {children}
      </h3>
      {action}
    </div>
  );
}

function StatCard({ label, value, star = false, onClick }: { label: string; value: number; star?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex items-center gap-1 text-lg font-bold leading-none tabular-nums">
        {star && <Star className="w-4 h-4 text-accent fill-accent" />}
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground mt-1">{label}</span>
    </>
  );
  const base = "rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-3 px-1 text-center";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} hover-elevate active-elevate-2`}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

function InterestChips({ selected }: { selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {selected.map((key) => {
        const def = INTEREST_MAP[key];
        if (!def) return null;
        const Icon = def.Icon;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border border-transparent bg-primary text-primary-foreground shadow-soft"
          >
            <Icon className="w-4 h-4" />
            {def.label}
          </span>
        );
      })}
    </div>
  );
}

type Achievement = { key: string; label: string; Icon: any; earned: boolean };

function AchievementGrid({ items }: { items: Achievement[] }) {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {items.map(({ key, label, Icon, earned }) => (
        <div
          key={key}
          className={
            "relative flex flex-col items-center justify-start text-center gap-1.5 rounded-2xl border p-2.5 " +
            (earned
              ? "bg-accent/10 border-accent/30 shadow-soft"
              : "bg-muted/40 border-border")
          }
        >
          <span
            className={
              "grid place-items-center w-10 h-10 rounded-full " +
              (earned ? "bg-accent/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground/50")
            }
          >
            <Icon className="w-5 h-5" />
          </span>
          <span className={"text-[10px] leading-tight font-semibold " + (earned ? "text-foreground" : "text-muted-foreground/70")}>
            {label}
          </span>
          {!earned && (
            <span className="absolute top-1.5 right-1.5 text-muted-foreground/50">
              <Lock className="w-3 h-3" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Illustrated rank emblem — sunrise→night art changes with the user's earned rank. */
type RankPalette = {
  sky: [string, string, string];
  orb: string;
  hills: string;
  water: string;
  wave1: string;
  wave2: string;
  night?: boolean;
};

const RANK_PALETTES: Record<number, RankPalette> = {
  1: { sky: ["#e0f2fe", "#bae6fd", "#7dd3fc"], orb: "#fde68a", hills: "#38bdf8", water: "#0ea5e9", wave1: "#bae6fd", wave2: "#e0f2fe" },
  2: { sky: ["#fef9c3", "#fde68a", "#38bdf8"], orb: "#facc15", hills: "#0ea5e9", water: "#0284c7", wave1: "#7dd3fc", wave2: "#bae6fd" },
  3: { sky: ["#fef3c7", "#fcd34d", "#0e7490"], orb: "#fbbf24", hills: "#0f766e", water: "#0e7490", wave1: "#67e8f9", wave2: "#a5f3fc" },
  4: { sky: ["#fed7aa", "#fb923c", "#7c2d12"], orb: "#f97316", hills: "#155e75", water: "#0c4a6e", wave1: "#38bdf8", wave2: "#7dd3fc" },
  5: { sky: ["#1e3a8a", "#312e81", "#0c4a6e"], orb: "#fde68a", hills: "#0c4a6e", water: "#082f49", wave1: "#38bdf8", wave2: "#67e8f9", night: true },
};

const STARS = [
  { x: 20, y: 16 }, { x: 70, y: 12 }, { x: 84, y: 28 }, { x: 14, y: 34 }, { x: 40, y: 10 },
];

function RankBadge({ rank }: { rank?: { tier?: number; title?: string; nextTitle?: string | null; nextNeeded?: number | null } | null }) {
  const tier = rank?.tier ?? 3;
  const title = rank?.title ?? "Dale Hollow Adventurer";
  const p = RANK_PALETTES[tier] ?? RANK_PALETTES[3];
  const gid = `rank-sky-${tier}`;
  return (
    <div className="shrink-0 flex flex-col items-center w-24">
      <div className="w-24 h-24 rounded-2xl overflow-hidden border border-card-border shadow-soft">
        <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label={`${title} rank badge`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.sky[0]} />
              <stop offset="50%" stopColor={p.sky[1]} />
              <stop offset="100%" stopColor={p.sky[2]} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#${gid})`} />
          {p.night &&
            STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r="1.1" fill="#fef9c3" opacity="0.9" />
            ))}
          <circle cx="50" cy="44" r="13" fill={p.orb} />
          <path d="M0,64 Q26,50 50,61 Q74,72 100,57 L100,72 L0,72 Z" fill={p.hills} />
          <rect y="70" width="100" height="30" fill={p.water} />
          <path d="M0,80 Q12,76 24,80 T48,80 T72,80 T96,80" stroke={p.wave1} strokeWidth="1.6" fill="none" opacity="0.7" />
          <path d="M0,88 Q12,84 24,88 T48,88 T72,88 T96,88" stroke={p.wave2} strokeWidth="1.6" fill="none" opacity="0.55" />
        </svg>
      </div>
      <span className="mt-1.5 text-[9px] font-extrabold uppercase tracking-wide text-center leading-tight text-foreground">
        {title}
      </span>
      {rank?.nextTitle && rank?.nextNeeded != null && (
        <span className="mt-0.5 text-[8px] text-center leading-tight text-muted-foreground">
          {rank.nextNeeded} more to {rank.nextTitle}
        </span>
      )}
    </div>
  );
}

/** Live presence status line: on the water > recently seen > offline. */
function StatusLine({ user }: { user: any }) {
  const lastSeenMs = user.lastSeen ? new Date(user.lastSeen).getTime() : null;
  const fresh = lastSeenMs != null && Date.now() - lastSeenMs < 10 * 60 * 1000;
  const onWater = !!user.isOnWater && !!user.isSharingLocation && fresh;

  if (onWater) {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-3 py-1 text-xs font-semibold" data-testid="status-on-water">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        On the water{user.homeMarina ? ` near ${user.homeMarina}` : " now"}
      </span>
    );
  }
  if (lastSeenMs != null && !isNaN(lastSeenMs)) {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground border border-border px-3 py-1 text-xs font-medium" data-testid="status-last-seen">
        <MapPin className="w-3 h-3" />
        Last seen {formatDistanceToNow(new Date(lastSeenMs), { addSuffix: true })}
      </span>
    );
  }
  return (
    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground border border-border px-3 py-1 text-xs font-medium" data-testid="status-offline">
      <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
      Offline
    </span>
  );
}

/** Dedicated boat showcase card — the highlight of every profile. */
function MyBoatCard({ user, isSelf, onPhotoView, onOpenDetail }: { user: any; isSelf: boolean; onPhotoView: (v: { src: string; alt: string }) => void; onOpenDetail?: () => void }) {
  if (user.showBoat === false) return null;
  const photo = resolveAvatarUrl(user.boatPhotoUrl);
  const hasDetails = user.boatName || photo || user.boatBrand || user.boatModel;
  if (!hasDetails) return null;

  const brandModel = [user.boatBrand, user.boatModel].filter(Boolean).join(" ");
  const chips: { icon?: React.ReactNode; label: string }[] = [];
  chips.push({ icon: <Ship className="w-3.5 h-3.5" />, label: boatLabelFor(user.boatType) });
  if (user.boatYear) chips.push({ label: String(user.boatYear) });
  if (user.boatColor) {
    chips.push({
      icon: <span className="inline-block w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: user.boatColor }} />,
      label: "Color",
    });
  }
  if (user.homeMarina) chips.push({ icon: <Anchor className="w-3.5 h-3.5" />, label: user.homeMarina });

  return (
    <div className={`${CARD} overflow-hidden`} data-testid="card-my-boat">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-sky-300 via-primary/70 to-secondary">
        {photo ? (
          <button
            type="button"
            onClick={() => onPhotoView({ src: photo, alt: `${user.boatName || "Boat"} photo` })}
            className="absolute inset-0 w-full h-full cursor-zoom-in"
            aria-label="View boat photo"
          >
            <img src={photo} alt={user.boatName || "Boat"} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="scale-[2.2]"
              style={{ color: user.boatColor || "#0ea5e9", lineHeight: 0, filter: "drop-shadow(0 6px 8px rgba(11,58,91,0.35))" }}
              dangerouslySetInnerHTML={{ __html: boatSvgFor(user.boatType) }}
            />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
          <p className="text-white text-xl font-extrabold drop-shadow flex items-center gap-2">
            🚤 {user.boatName || boatLabelFor(user.boatType)}
          </p>
          {brandModel && <p className="text-white/90 text-sm font-medium drop-shadow">{brandModel}</p>}
        </div>
        {isSelf && (
          <div className="absolute top-3 right-3">
            <Button size="sm" variant="secondary" className="rounded-full bg-white/85 backdrop-blur shadow-soft" asChild>
              <Link href="/settings/vessel" data-testid="link-edit-boat">Edit</Link>
            </Button>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-wrap items-center gap-2">
        {chips.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
            {c.icon}
            {c.label}
          </span>
        ))}
        {onOpenDetail && (
          <button
            type="button"
            onClick={onOpenDetail}
            className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:opacity-70"
            data-testid="button-boat-details"
          >
            Details <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Fleet strip — every boat in the captain's fleet, tap one to open its profile. */
function FleetSection({ fleet, onOpenBoat }: { fleet: any[]; onOpenBoat: (b: any) => void }) {
  return (
    <div className={`${CARD} p-4`} data-testid="card-my-fleet">
      <SectionTitle icon={Ship}>My Fleet · {fleet.length}</SectionTitle>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {fleet.map((b) => {
          const photo = resolveAvatarUrl(b.photoUrl);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onOpenBoat(b)}
              className="shrink-0 w-[130px] rounded-2xl border border-border bg-background overflow-hidden text-left hover:border-primary/40 transition-colors"
              data-testid={`button-fleet-boat-${b.id}`}
            >
              <div className="relative h-[74px] bg-gradient-to-br from-sky-200 via-primary/30 to-secondary/40">
                {photo ? (
                  <img src={photo} alt={b.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="scale-110"
                      style={{ color: b.color || "#0ea5e9", lineHeight: 0, filter: "drop-shadow(0 3px 4px rgba(11,58,91,0.3))" }}
                      dangerouslySetInnerHTML={{ __html: boatSvgFor(b.boatType) }}
                    />
                  </div>
                )}
                {b.isPrimary && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/90 text-primary text-[9px] font-bold px-1.5 py-0.5 shadow-sm">
                    <Star className="w-2.5 h-2.5 fill-current" /> Primary
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-bold truncate">{b.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{boatLabelFor(b.boatType)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Full boat profile dialog — photo, specs, story, and tagged memories. */
function BoatDetailDialog({
  boat,
  homeMarina,
  gallery,
  onOpenChange,
  onViewMedia,
}: {
  boat: any | null;
  homeMarina?: string | null;
  gallery?: any[];
  onOpenChange: (open: boolean) => void;
  onViewMedia: (item: any) => void;
}) {
  const photo = boat ? resolveAvatarUrl(boat.photoUrl) : null;
  const memories = boat ? (gallery ?? []).filter((g: any) => g.boatId === boat.id) : [];
  const brandModel = boat ? [boat.year, boat.brand, boat.model].filter(Boolean).join(" ") : "";
  return (
    <Dialog open={!!boat} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0">
        {boat && (
          <>
            <div className="relative aspect-[16/9] bg-gradient-to-br from-sky-300 via-primary/70 to-secondary rounded-t-lg overflow-hidden">
              {photo ? (
                <img src={photo} alt={boat.name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="scale-[2]"
                    style={{ color: boat.color || "#0ea5e9", lineHeight: 0, filter: "drop-shadow(0 6px 8px rgba(11,58,91,0.35))" }}
                    dangerouslySetInnerHTML={{ __html: boatSvgFor(boat.boatType) }}
                  />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
                <p className="text-white text-lg font-extrabold drop-shadow flex items-center gap-2">
                  {boat.name}
                  {boat.isPrimary && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 text-primary text-[10px] font-bold px-1.5 py-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" /> Primary
                    </span>
                  )}
                </p>
                {brandModel && <p className="text-white/90 text-xs font-medium drop-shadow">{brandModel}</p>}
              </div>
            </div>
            <div className="p-4 space-y-4">
              <DialogHeader className="sr-only">
                <DialogTitle>{boat.name}</DialogTitle>
                <DialogDescription>Boat details</DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                  <Ship className="w-3.5 h-3.5" /> {boatLabelFor(boat.boatType)}
                </span>
                {boat.color && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                    <span className="inline-block w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: boat.color }} />
                    Color
                  </span>
                )}
                {homeMarina && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                    <Anchor className="w-3.5 h-3.5" /> {homeMarina}
                  </span>
                )}
              </div>
              {boat.notes && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{boat.notes}</p>
              )}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Memories</p>
                {memories.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {memories.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        className="relative aspect-square rounded-xl overflow-hidden bg-muted cursor-zoom-in"
                        onClick={() => onViewMedia(item)}
                      >
                        <MatureGate isMature={item.isMature} rounded="rounded-xl" className="w-full h-full">
                          {item.mediaType === "video" ? (
                            <>
                              <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-black/40 rounded-full p-1.5">
                                  <Play className="w-4 h-4 text-white fill-white" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img src={item.mediaUrl} alt={item.caption ?? "Memory"} className="w-full h-full object-cover" />
                          )}
                        </MatureGate>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No memories tagged to this boat yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AboutCard({ user }: { user: any }) {
  const items: { icon: React.ReactNode; label: string }[] = [];
  if (user.location) items.push({ icon: <MapPin className="w-4 h-4" />, label: `Lives in ${user.location}` });
  if (user.hometown) items.push({ icon: <Home className="w-4 h-4" />, label: `From ${user.hometown}` });
  if (user.work) items.push({ icon: <Briefcase className="w-4 h-4" />, label: user.work });
  const bday = formatBirthday(user.birthday);
  if (bday) items.push({ icon: <Cake className="w-4 h-4" />, label: bday });
  if (user.relationshipStatus) items.push({ icon: <Heart className="w-4 h-4" />, label: user.relationshipStatus });
  if (user.gender) items.push({ icon: <User2 className="w-4 h-4" />, label: user.gender });

  const hasBio = !!user.bio;

  return (
    <div className={`${CARD} p-4`}>
      <SectionTitle icon={User2}>About Me</SectionTitle>
      {hasBio && <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{user.bio}</p>}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          {items.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="grid place-items-center w-7 h-7 rounded-lg bg-primary/10 text-primary shrink-0">
                    {item.icon}
                  </span>
                  <span className="text-foreground/90">{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            !hasBio && <p className="text-sm text-muted-foreground">No details shared yet.</p>
          )}
        </div>
        <RankBadge rank={user.rank} />
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { data: me } = useGetMe();

  const isSelf = userId === "me" || (me != null && parseInt(userId) === me.id);
  const id = isSelf ? me?.id ?? 0 : parseInt(userId);

  const { data: otherUser, isLoading: loadingOther } = useGetUser(id, {
    query: { queryKey: getGetUserQueryKey(id), enabled: !isSelf && !!id },
  });
  const user = isSelf ? me : otherUser;
  const loadingUser = isSelf ? !me : loadingOther;

  const showFollowers = (otherUser as any)?.showFollowers;
  const canViewFollows = isSelf || showFollowers !== false;
  const showFriendsSetting = (otherUser as any)?.showFriends;
  const canViewFriends = isSelf || showFriendsSetting !== false;

  const { data: posts, isLoading: loadingPosts } = useGetPosts({});
  const { data: pins, isLoading: loadingPins } = useGetPins(
    id ? { profileUserId: id } : {},
    { query: { enabled: !!id } }
  );
  const { data: friends } = useGetFriends();
  const { data: gallery, isLoading: loadingGallery } = useGetGallery(
    id ? { profileUserId: id } : {},
    { query: { enabled: !!id } }
  );
  const { data: catches } = useGetCatches(
    id ? { profileUserId: id } : {},
    { query: { enabled: !!id } }
  );
  const { data: favoritePins } = useGetFavoritePins({ query: { enabled: isSelf } });
  const followersQuery = useGetFollowers(id, { query: { enabled: !!id && canViewFollows } });
  const followingQuery = useGetFollowing(id, { query: { enabled: !!id && canViewFollows } });
  const profileFriendsQuery = useGetUserFriends(id, { query: { enabled: !!id && canViewFriends } });
  const profileFriends = profileFriendsQuery.data;

  const queryClient = useQueryClient();
  const reactPost = useReactToPost();
  const deletePost = useDeletePost();
  const [openPostId, setOpenPostId] = React.useState<number | null>(null);
  const openPost = openPostId != null ? posts?.find((p) => p.id === openPostId) ?? null : null;
  const refreshPosts = () => queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
  const handleDeletePost = (postId: number) => {
    deletePost.mutate(
      { postId },
      {
        onSuccess: () => { toast.success("Post deleted."); setOpenPostId(null); refreshPosts(); },
        onError: () => toast.error("Couldn't delete that post."),
      }
    );
  };
  const createGalleryItem = useCreateGalleryItem();
  const deleteGalleryItem = useDeleteGalleryItem();
  const { uploadFile, isUploading } = useUpload();
  const mediaInputRef = React.useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [mediaType, setMediaType] = React.useState<"image" | "video">("image");
  const [boatTagId, setBoatTagId] = React.useState<number | null>(null);
  const [openBoat, setOpenBoat] = React.useState<any | null>(null);

  const [tab, setTab] = React.useState("posts");
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const goToTab = (value: string) => {
    setTab(value);
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const refreshGallery = () =>
    queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey(id ? { profileUserId: id } : {}) });

  const resetGallery = () => {
    setCaption("");
    setMediaUrl(null);
    setMediaType("image");
    setBoatTagId(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const handleMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Please choose a photo or video file.");
      return;
    }
    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const res = await uploadFile(toUpload);
      if (res?.objectPath) {
        setMediaUrl(res.objectPath);
        setMediaType(isVideo ? "video" : "image");
      } else {
        toast.error("Couldn't upload that file.");
      }
    } catch {
      toast.error("Couldn't upload that file.");
    }
  };

  const handleGallerySubmit = () => {
    if (!mediaUrl) {
      toast.error("Add a photo or video first.");
      return;
    }
    createGalleryItem.mutate(
      {
        data: {
          mediaUrl: `/api/storage${mediaUrl}`,
          mediaType,
          caption: caption.trim() || undefined,
          boatId: boatTagId ?? undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Added to your gallery!");
          setGalleryOpen(false);
          resetGallery();
          refreshGallery();
        },
        onError: () => toast.error("Couldn't add that to your gallery."),
      }
    );
  };

  const [viewerItem, setViewerItem] = React.useState<{ id: number; mediaUrl: string; mediaType: string; caption?: string | null } | null>(null);

  const handleGalleryDelete = (itemId: number) => {
    deleteGalleryItem.mutate(
      { itemId },
      {
        onSuccess: () => { toast.success("Removed."); refreshGallery(); },
        onError: () => toast.error("Couldn't remove that item."),
      }
    );
  };

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const blockUser = useBlockUser();
  const [reportOpen, setReportOpen] = React.useState(false);
  const unblockUser = useUnblockUser();
  const deleteUser = useDeleteUser();
  const [, navigate] = useLocation();

  const refreshRelationship = () => {
    queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBlockedUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFollowersQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetFollowingQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetUserFriendsQueryKey(id) });
  };

  const [followList, setFollowList] = React.useState<"followers" | "following" | "friends" | null>(null);
  const [photoView, setPhotoView] = React.useState<{ src: string; alt: string } | null>(null);
  const friendStatus = (otherUser as any)?.friendStatus as string | undefined;
  const isFriend = friendStatus ? friendStatus === "accepted" : friends?.some((f) => f.id === id);
  const isBlocked = friendStatus === "blocked";
  const isPending = friendStatus === "pending_out";
  const userPosts = posts?.filter((p) => p.userId === id);
  const userPins = pins?.filter((p) => p.userId === id);

  const handleFollow = () =>
    followUser.mutate({ userId: id }, { onSuccess: refreshRelationship });
  const handleUnfollow = () =>
    unfollowUser.mutate({ userId: id }, { onSuccess: refreshRelationship, onError: () => toast.error("Couldn't update.") });
  const handleBlock = () =>
    blockUser.mutate({ userId: id }, {
      onSuccess: () => { toast.success("User blocked."); refreshRelationship(); },
      onError: () => toast.error("Couldn't block this user."),
    });
  const handleUnblock = () =>
    unblockUser.mutate({ userId: id }, {
      onSuccess: () => { toast.success("User unblocked."); refreshRelationship(); },
      onError: () => toast.error("Couldn't unblock this user."),
    });
  const handleDeleteProfile = () =>
    deleteUser.mutate({ userId: id }, {
      onSuccess: () => {
        toast.success(`Deleted @${user?.username}'s profile.`);
        navigate("/");
      },
      onError: () => toast.error("Couldn't delete this profile."),
    });

  /* ------------------------------- Derived data ------------------------------ */

  const postCount = userPosts?.length ?? 0;
  const pinCount = userPins?.length ?? 0;
  const catchCount = catches?.length ?? 0;
  const galleryCount = gallery?.length ?? 0;
  const followersCount = canViewFollows ? (followersQuery.data?.length ?? user?.followerCount ?? 0) : (user?.followerCount ?? 0);
  const followingCount = canViewFollows ? (followingQuery.data?.length ?? user?.followingCount ?? 0) : (user?.followingCount ?? 0);

  const activeInterests = React.useMemo<string[]>(
    () => (user as any)?.interests ?? [],
    [user],
  );

  const achievements = React.useMemo<Achievement[]>(
    () =>
      (user?.badges ?? []).map((b) => ({
        key: b.key,
        label: b.label,
        Icon: badgeMeta(b.key).Icon,
        earned: b.earned,
      })),
    [user],
  );
  const earnedBadges = achievements.filter((a) => a.earned);
  const lockedBadges = achievements.filter((a) => !a.earned);
  // Most-recent first (advanced badges sit later in the catalog and are earned later).
  const recentEarned = [...earnedBadges].reverse();
  const [badgesOpen, setBadgesOpen] = React.useState(false);

  const recentActivity = React.useMemo(() => {
    type Item = { key: string; Icon: any; color: string; label: string; time: number };
    const items: Item[] = [];
    (userPosts ?? []).forEach((p) => items.push({
      key: `post-${p.id}`, Icon: FileText, color: "text-primary bg-primary/10",
      label: p.title ? `Posted “${p.title}”` : "Shared a post", time: new Date(p.createdAt).getTime(),
    }));
    (catches ?? []).forEach((c) => items.push({
      key: `catch-${c.id}`, Icon: Fish, color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
      label: `Caught a ${c.species}`, time: new Date(c.caughtAt).getTime(),
    }));
    (userPins ?? []).forEach((p) => items.push({
      key: `pin-${p.id}`, Icon: MapPin, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      label: p.type === "marina" ? `Checked in at ${p.title}` : `Marked ${p.title} on the map`, time: new Date(p.createdAt).getTime(),
    }));
    (gallery ?? []).forEach((g) => items.push({
      key: `gallery-${g.id}`, Icon: ImageIcon, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      label: g.caption ? `Added a lake memory · ${g.caption}` : "Added a new lake memory", time: new Date(g.createdAt).getTime(),
    }));
    return items.filter((i) => !isNaN(i.time)).sort((a, b) => b.time - a.time).slice(0, 5);
  }, [userPosts, catches, userPins, gallery]);

  const galleryPreview = (gallery ?? []).slice(0, 6);

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {loadingUser ? (
        <div className="p-6 space-y-6">
          <Skeleton className="w-full h-52 rounded-3xl" />
          <div className="flex flex-col items-center gap-3 -mt-16">
            <Skeleton className="w-28 h-28 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}
          </div>
        </div>
      ) : user ? (
        <>
          {/* Hero: scenic cover photo + overlapping avatar */}
          <section className="relative">
            <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-primary via-secondary to-primary/60">
              {user.coverUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoView({ src: `/api/storage${user.coverUrl}`, alt: "Cover photo" })}
                  className="w-full h-full cursor-zoom-in"
                  aria-label="View cover photo"
                >
                  <img src={`/api/storage${user.coverUrl}`} alt="Cover photo" className="w-full h-full object-cover" />
                </button>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15 pointer-events-none" />
            </div>

            {/* Floating nav */}
            <div className="absolute top-4 left-4 z-10">
              <Link href={isSelf ? "/" : "/friends"}>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Back"
                  className="rounded-full bg-white/85 text-foreground hover:bg-white shadow-soft backdrop-blur"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            </div>

            {/* Identity card overlapping the cover */}
            <div className="px-3 -mt-14 relative z-10">
              <div className="relative rounded-[28px] bg-card border border-card-border shadow-soft-lg px-5 pt-16 pb-5 flex flex-col items-center">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                  {user.avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        const src = resolveAvatarUrl(user.avatarUrl);
                        if (src) setPhotoView({ src, alt: "Profile photo" });
                      }}
                      className="cursor-zoom-in rounded-full"
                      aria-label="View profile photo"
                    >
                      <UserAvatar
                        name={user.displayName}
                        username={user.username}
                        avatarUrl={user.avatarUrl}
                        online={user.isOnline}
                        className="w-24 h-24 ring-4 ring-white dark:ring-card shadow-soft-lg"
                      />
                    </button>
                  ) : (
                    <UserAvatar
                      name={user.displayName}
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      online={user.isOnline}
                      className="w-24 h-24 ring-4 ring-white dark:ring-card shadow-soft-lg"
                    />
                  )}
                </div>

                <h2 className="text-2xl font-bold flex items-center gap-1.5 text-center">
                  {user.displayName}
                  {user.isBusiness && <BadgeCheck className="w-5 h-5 text-primary" />}
                </h2>
                <p className="text-muted-foreground text-sm">@{user.username}</p>
                <StatusLine user={user} />

                <BadgeRow badges={user.badges} limit={4} onViewAll={() => setBadgesOpen(true)} />

                <Dialog open={badgesOpen} onOpenChange={setBadgesOpen}>
                  <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Badges</DialogTitle>
                      <DialogDescription>
                        {earnedBadges.length} earned · {lockedBadges.length} to unlock
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                      {recentEarned.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Earned</h4>
                          <AchievementGrid items={recentEarned} />
                        </div>
                      )}
                      {lockedBadges.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Locked</h4>
                          <AchievementGrid items={lockedBadges} />
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Quick stats */}
                <div className="grid grid-cols-4 gap-2 w-full mt-5">
                  <StatCard label="Posts" value={postCount} onClick={() => goToTab("posts")} />
                  <StatCard label="Followers" value={followersCount} onClick={canViewFollows ? () => setFollowList("followers") : undefined} />
                  <StatCard label="Following" value={followingCount} onClick={canViewFollows ? () => setFollowList("following") : undefined} />
                  {isSelf ? (
                    <StatCard label="Favorites" value={favoritePins?.length ?? 0} star onClick={() => navigate("/map")} />
                  ) : (
                    <StatCard label="Catches" value={catchCount} star />
                  )}
                </div>

              {/* Find me on Map (own profile) */}
              {isSelf && (
                <div className="w-full max-w-xs mt-5">
                  <Button variant="outline" className="w-full rounded-2xl" asChild>
                    <Link href={user.currentLat != null && user.currentLng != null ? `/map?lat=${user.currentLat}&lng=${user.currentLng}` : "/map"}>
                      <MapPin className="w-4 h-4 mr-2" /> Find me on Map
                    </Link>
                  </Button>
                </div>
              )}

              {/* Actions */}
              {!isSelf && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-5">
                {isBlocked ? (
                  <Button variant="outline" className="flex-1 rounded-2xl" onClick={handleUnblock} disabled={unblockUser.isPending}>
                    <ShieldOff className="w-4 h-4 mr-2" /> Unblock
                  </Button>
                ) : (
                  <>
                    <div className="flex gap-2 w-full">
                      {isFriend ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="flex-1 rounded-2xl">
                              <UserMinus className="w-4 h-4 mr-2" /> Unfriend
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Unfriend {user.displayName}?</AlertDialogTitle>
                              <AlertDialogDescription>You'll no longer be connected on the lake.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleUnfollow}>Unfriend</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : isPending ? (
                        <Button variant="outline" className="flex-1 rounded-2xl" onClick={handleUnfollow} disabled={unfollowUser.isPending}>
                          <Clock className="w-4 h-4 mr-2" /> Requested
                        </Button>
                      ) : (
                        <Button className="flex-1 rounded-2xl" onClick={handleFollow} disabled={followUser.isPending}>
                          <UserPlus className="w-4 h-4 mr-2" /> Follow
                        </Button>
                      )}
                      <Button variant="secondary" className="flex-1 rounded-2xl" asChild>
                        <Link href={`/messages?user=${id}`}><MessageSquare className="w-4 h-4 mr-2" /> Message</Link>
                      </Button>
                    </div>
                    {user.shareLocation && user.currentLat != null && user.currentLng != null ? (
                      <Button variant="outline" className="w-full rounded-2xl" asChild>
                        <Link href={`/map?lat=${user.currentLat}&lng=${user.currentLng}`}>
                          <MapPin className="w-4 h-4 mr-2" /> Find on Map
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full rounded-2xl" disabled>
                        <MapPin className="w-4 h-4 mr-2" /> Location off
                      </Button>
                    )}
                    <div className="flex gap-2 justify-center">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setReportOpen(true)}>
                        <Flag className="w-4 h-4 mr-2" /> Report
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                            <Ban className="w-4 h-4 mr-2" /> Block
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Block {user.displayName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Blocked users will no longer be able to view your location or interact with you. You can unblock them later from Settings.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Block
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {me?.isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete profile
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {user.displayName}'s profile?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes their account and all of their posts, pins, catches, photos, messages, and other content. This can't be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteProfile} disabled={deleteUser.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete profile
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </>
                )}
              </div>
              )}
              </div>
            </div>
          </section>

          <FollowListDialog
            userId={id}
            mode={followList}
            onOpenChange={(open) => { if (!open) setFollowList(null); }}
          />

          {/* Body */}
          <div className="px-4 pt-5 pb-24 space-y-5">
            {/* My Boat / My Fleet */}
            <MyBoatCard
              user={user}
              isSelf={isSelf}
              onPhotoView={setPhotoView}
              onOpenDetail={
                (user as any).fleet?.length
                  ? () => setOpenBoat((user as any).fleet.find((b: any) => b.isPrimary) ?? (user as any).fleet[0])
                  : undefined
              }
            />
            {(user as any).showBoat !== false && ((user as any).fleet?.length ?? 0) > 1 && (
              <FleetSection fleet={(user as any).fleet} onOpenBoat={setOpenBoat} />
            )}

            {/* About */}
            <AboutCard user={user} />

            {/* Interests */}
            {activeInterests.length > 0 && (
              <div className={`${CARD} p-4`}>
                <SectionTitle icon={Heart}>Interests</SectionTitle>
                <InterestChips selected={activeInterests} />
              </div>
            )}

            {/* Friends */}
            {canViewFriends ? (
              <div className={`${CARD} p-4`}>
                <SectionTitle
                  icon={Users}
                  action={
                    (profileFriends?.length ?? 0) > 4 ? (
                      <button type="button" onClick={() => setFollowList("friends")} className="text-xs font-semibold text-primary flex items-center gap-0.5 hover:opacity-70">
                        See all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : undefined
                  }
                >
                  Friends{(profileFriends?.length ?? 0) > 0 ? ` · ${profileFriends!.length}` : ""}
                </SectionTitle>
                {profileFriends && profileFriends.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2.5">
                    {profileFriends.slice(0, 4).map((f: any) => (
                      <Link key={f.id} href={`/profile/${f.id}`} className="flex flex-col items-center gap-1.5">
                        <UserAvatar name={f.displayName} username={f.username} avatarUrl={f.avatarUrl ?? undefined} className="w-14 h-14" />
                        <span className="block w-full text-[11px] font-medium text-center leading-tight truncate">{f.displayName}</span>
                        {f.showBoat !== false && (f.boatName || f.boatPhotoUrl) ? (
                          <span className="flex items-center justify-center gap-1 w-full text-[9.5px] text-muted-foreground leading-tight">
                            {f.boatPhotoUrl ? (
                              <img src={resolveAvatarUrl(f.boatPhotoUrl)} alt="" className="w-4 h-4 rounded-full object-cover border border-border shrink-0" />
                            ) : (
                              <Ship className="w-3 h-3 shrink-0" style={{ color: f.boatColor || undefined }} />
                            )}
                            <span className="truncate">{boatLabelFor(f.boatType)}</span>
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    {isSelf ? "Find people you know on the lake to build your crew." : "No friends to show yet."}
                  </p>
                )}
              </div>
            ) : (
              <div className={`${CARD} p-4`}>
                <SectionTitle icon={Users}>Friends</SectionTitle>
                <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> This captain keeps their friends list private.
                </p>
              </div>
            )}

            <WaveDivider />

            {/* Gallery preview */}
            <div className={`${CARD} p-4`}>
              <SectionTitle
                icon={Camera}
                action={
                  galleryCount > 0 ? (
                    <button type="button" onClick={() => goToTab("gallery")} className="text-xs font-semibold text-primary flex items-center gap-0.5 hover:opacity-70">
                      See all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : undefined
                }
              >
                Lake Memories
              </SectionTitle>
              {galleryPreview.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {galleryPreview.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setViewerItem(item)}
                      className="relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-zoom-in"
                      aria-label={item.mediaType === "video" ? "View video" : "View photo"}
                    >
                      <MatureGate isMature={(item as any).isMature} rounded="rounded-2xl" className="w-full h-full">
                      {item.mediaType === "video" ? (
                        <>
                          <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-black/40 rounded-full p-1.5">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </span>
                          </span>
                        </>
                      ) : (
                        <img src={item.mediaUrl} alt={item.caption ?? "Gallery item"} className="w-full h-full object-cover" />
                      )}
                      </MatureGate>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {isSelf ? "Share your first lake memory below — boat days, sunsets, big catches." : "No lake memories shared yet."}
                </p>
              )}
            </div>

            <WaveDivider />

            {/* Recent activity */}
            <div className={`${CARD} p-4`}>
              <SectionTitle icon={Clock}>Recent Activity</SectionTitle>
              {recentActivity.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {recentActivity.map(({ key, Icon, color, label, time }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`grid place-items-center w-9 h-9 rounded-full shrink-0 ${color}`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(time), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No activity on the lake yet.</p>
              )}
            </div>

            {/* Detailed tabs */}
            <div ref={tabsRef} className="pt-1">
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="w-full mb-4 rounded-2xl">
                  <TabsTrigger value="posts" className="flex-1 rounded-xl">📰 Posts</TabsTrigger>
                  <TabsTrigger value="pins" className="flex-1 rounded-xl">📍 Check-ins</TabsTrigger>
                  <TabsTrigger value="gallery" className="flex-1 rounded-xl">📸 Photos</TabsTrigger>
                </TabsList>

                <TabsContent value="posts" className="space-y-4">
                  {loadingPosts ? (
                    <Skeleton className="h-32 w-full rounded-3xl" />
                  ) : userPosts?.length ? (
                    userPosts.map((post) => (
                      <Card
                        key={post.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open post${post.title ? `: ${post.title}` : ""}`}
                        onClick={() => setOpenPostId(post.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenPostId(post.id); } }}
                        className="rounded-3xl border-card-border shadow-soft hover-elevate cursor-pointer"
                      >
                        <CardContent className="p-4">
                          {post.title && <h3 className="font-bold">{post.title}</h3>}
                          {post.content && <p className="text-sm mt-1 line-clamp-3">{post.content}</p>}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      {isSelf ? "You haven't posted yet." : "No posts yet."}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pins" className="space-y-4">
                  {loadingPins ? (
                    <Skeleton className="h-24 w-full rounded-3xl" />
                  ) : userPins?.length ? (
                    userPins.map((pin) => {
                      const window = pinWindow(pin.startTime, pin.endTime);
                      const canLocate = pin.lat != null && pin.lng != null;
                      const card = (
                        <Card key={pin.id} className={`rounded-3xl border-card-border shadow-soft ${canLocate ? "transition-colors hover:bg-muted/40 cursor-pointer" : ""}`}>
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-xl">
                              {pinEmoji(pin.type)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm">{pin.title}</h3>
                                <PinVisibility visibility={pin.visibility} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{pin.description}</p>
                              {window && <p className="text-[11px] text-primary font-medium mt-0.5">{window}</p>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                      return canLocate ? (
                        <Link key={pin.id} href={`/map?lat=${pin.lat}&lng=${pin.lng}`} className="block">
                          {card}
                        </Link>
                      ) : card;
                    })
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      {isSelf ? "You haven't checked in anywhere yet." : "No check-ins yet."}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gallery" className="space-y-4">
                  {isSelf && (
                    <>
                      <input
                        ref={mediaInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleMedia}
                      />
                      <Button
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={() => setGalleryOpen(true)}
                      >
                        <ImagePlus className="w-4 h-4 mr-2" /> Add photos and videos
                      </Button>
                    </>
                  )}

                  {loadingGallery ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : gallery?.length ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      {gallery.map((item) => (
                        <div key={item.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-muted">
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={item.mediaType === "video" ? "View video" : "View photo"}
                            className="w-full h-full cursor-zoom-in"
                            onClick={() => setViewerItem(item)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewerItem(item); } }}
                          >
                            <MatureGate isMature={(item as any).isMature} rounded="rounded-2xl" className="w-full h-full">
                            {item.mediaType === "video" ? (
                              <>
                                <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="bg-black/40 rounded-full p-2">
                                    <Play className="w-5 h-5 text-white fill-white" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <img src={item.mediaUrl} alt={item.caption ?? "Gallery item"} className="w-full h-full object-cover" />
                            )}
                            </MatureGate>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      {isSelf ? "Add your first photos and videos." : "No photos or videos yet."}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </>
      ) : (
        <div className="p-10 text-center text-muted-foreground">User not found</div>
      )}

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
              canDelete={isSelf}
              onDelete={() => handleDeletePost(openPost.id)}
              currentUserId={me?.id}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={galleryOpen} onOpenChange={(o) => { setGalleryOpen(o); if (!o) resetGallery(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to gallery</DialogTitle>
            <DialogDescription>Share a photo or video on your profile.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Photo or video</Label>
              {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                  {mediaType === "video" ? (
                    <video src={`/api/storage${mediaUrl}`} className="object-cover w-full h-full" controls playsInline />
                  ) : (
                    <img src={`/api/storage${mediaUrl}`} alt="Preview" className="object-cover w-full h-full" />
                  )}
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setMediaUrl(null); if (mediaInputRef.current) mediaInputRef.current.value = ""; }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Choose photo or video"}
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption (optional)" />
            </div>
            {isSelf && ((me as any)?.fleet?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <Label>Tag a boat <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex flex-wrap gap-1.5">
                  {(me as any).fleet.map((b: any) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBoatTagId(boatTagId === b.id ? null : b.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${boatTagId === b.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                      data-testid={`button-tag-boat-${b.id}`}
                    >
                      <Ship className="w-3.5 h-3.5" style={{ color: b.color || undefined }} />
                      {b.name}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Tagged photos show up in that boat's memories.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setGalleryOpen(false); resetGallery(); }}>Cancel</Button>
            <Button onClick={handleGallerySubmit} disabled={createGalleryItem.isPending || isUploading || !mediaUrl}>
              {createGalleryItem.isPending ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoatDetailDialog
        boat={openBoat}
        homeMarina={(user as any)?.homeMarina}
        gallery={gallery as any[] | undefined}
        onOpenChange={(open) => { if (!open) setOpenBoat(null); }}
        onViewMedia={(item) => { setOpenBoat(null); setViewerItem(item); }}
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={id} />

      <ImageLightbox
        src={viewerItem?.mediaUrl ?? null}
        alt={viewerItem?.caption ?? "Gallery item"}
        mediaType={viewerItem?.mediaType === "video" ? "video" : "image"}
        open={!!viewerItem}
        onClose={() => setViewerItem(null)}
        onDelete={isSelf && viewerItem ? () => handleGalleryDelete(viewerItem.id) : undefined}
      />

      <ImageLightbox src={photoView?.src ?? null} alt={photoView?.alt ?? ""} open={!!photoView} onClose={() => setPhotoView(null)} />
    </div>
  );
}

function FollowListDialog({
  userId,
  mode,
  onOpenChange,
}: {
  userId: number;
  mode: "followers" | "following" | "friends" | null;
  onOpenChange: (open: boolean) => void;
}) {
  const followers = useGetFollowers(userId, { query: { enabled: mode === "followers" } });
  const following = useGetFollowing(userId, { query: { enabled: mode === "following" } });
  const friends = useGetUserFriends(userId, { query: { enabled: mode === "friends" } });
  const active = mode === "followers" ? followers : mode === "following" ? following : friends;
  const list = active.data;
  const isLoading = active.isLoading;
  const isError = active.isError;

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "followers" ? "Followers" : mode === "following" ? "Following" : "Friends"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground text-center py-8">This list is private.</p>
          ) : !list || list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {mode === "followers" ? "No followers yet." : mode === "following" ? "Not following anyone yet." : "No friends yet."}
            </p>
          ) : (
            <div className="space-y-1 py-1">
              {list.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl ?? undefined} className="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {u.displayName}
                      {u.isBusiness && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
