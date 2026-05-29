import React from "react";
import {
  useGetPins,
  useGetFavoritePins,
  useGetPendingPins,
  useApprovePin,
  useGetMe,
  getGetPinsQueryKey,
  getGetPendingPinsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Navigation, Check, Lock, Globe, Users, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const OWNER_ID = 1;

const PIN_TYPES = [
  { value: 'all', label: 'All', emoji: '📍' },
  { value: 'fishing_spot', label: 'Fishing', emoji: '🎣' },
  { value: 'campsite', label: 'Camping', emoji: '🏕️' },
  { value: 'marina', label: 'Marinas', emoji: '⛵' },
  { value: 'cliff', label: 'Cliffs', emoji: '🏔️' },
  { value: 'waterfall', label: 'Falls', emoji: '💧' },
  { value: 'hazard', label: 'Hazards', emoji: '⚠️' },
];

function pinEmoji(type: string) {
  return PIN_TYPES.find(t => t.value === type)?.emoji || '📍';
}

function VisibilityBadge({ visibility }: { visibility?: string }) {
  if (visibility === "public") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Globe className="w-3 h-3" /> Public
      </Badge>
    );
  }
  if (visibility === "community") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Users className="w-3 h-3" /> Community
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-[10px]">
      <Lock className="w-3 h-3" /> Friends
    </Badge>
  );
}

function formatWindow(startTime?: string | null, endTime?: string | null) {
  if (!startTime && !endTime) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (startTime && endTime) return `${fmt(startTime)} – ${fmt(endTime)}`;
  if (startTime) return `From ${fmt(startTime)}`;
  return `Until ${fmt(endTime!)}`;
}

export function PinsPage() {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState("");

  const { data: me } = useGetMe();
  const isOwner = me?.id === OWNER_ID;

  const isSaved = filter === "saved";
  const { data: pins, isLoading } = useGetPins(
    filter !== 'all' && !isSaved ? { type: filter as any } : {},
    { query: { enabled: !isSaved } }
  );
  const { data: favoritePins, isLoading: favoritesLoading } = useGetFavoritePins({
    query: { enabled: isSaved },
  });
  const { data: pendingPins } = useGetPendingPins({ query: { enabled: isOwner } });
  const approvePin = useApprovePin();
  const queryClient = useQueryClient();

  const handleApprove = (pinId: number) => {
    approvePin.mutate({ pinId }, {
      onSuccess: () => {
        toast.success("Pin approved and published.");
        queryClient.invalidateQueries({ queryKey: getGetPendingPinsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPinsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetPinsQueryKey() });
      },
      onError: () => toast.error("Could not approve pin."),
    });
  };

  const sourcePins = isSaved ? favoritePins : pins;
  const listLoading = isSaved ? favoritesLoading : isLoading;

  const filteredPins = React.useMemo(() => {
    if (!sourcePins) return [];
    if (!search) return sourcePins;
    const lowerSearch = search.toLowerCase();
    return sourcePins.filter(p =>
      p.title.toLowerCase().includes(lowerSearch) ||
      p.description?.toLowerCase().includes(lowerSearch)
    );
  }, [sourcePins, search]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 space-y-4">
        <h1 className="text-2xl font-bold text-primary">Lake Pins</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search spots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Badge
            variant={filter === "saved" ? "default" : "secondary"}
            className="cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm"
            onClick={() => setFilter("saved")}
          >
            <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Saved
          </Badge>
          {PIN_TYPES.map(type => (
            <Badge
              key={type.value}
              variant={filter === type.value ? "default" : "secondary"}
              className="cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm"
              onClick={() => setFilter(type.value)}
            >
              <span className="mr-1.5">{type.emoji}</span> {type.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isOwner && pendingPins && pendingPins.length > 0 && (
          <div className="space-y-3 mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approval ({pendingPins.length})
            </h2>
            {pendingPins.map(pin => {
              return (
                <Card key={pin.id} className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
                  <CardContent className="p-4 flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 text-2xl">
                      {pinEmoji(pin.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate">{pin.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{pin.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                        Requested by {pin.user?.displayName || 'Unknown'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 gap-1"
                      disabled={approvePin.isPending}
                      onClick={() => handleApprove(pin.id)}
                    >
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {listLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : filteredPins.length ? (
          filteredPins.map(pin => {
            const window = formatWindow(pin.startTime, pin.endTime);
            return (
              <Card key={pin.id} className="hover-elevate overflow-hidden border-border/50">
                <CardContent className="p-4 flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-3xl shrink-0 shadow-inner">
                    {pinEmoji(pin.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base truncate">{pin.title}</h3>
                      <VisibilityBadge visibility={pin.visibility} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{pin.description}</p>
                    {window && (
                      <p className="text-[11px] text-primary mt-1 font-medium">{window}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                      Added by {pin.user?.displayName || 'Unknown'}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="shrink-0 text-primary hover:bg-primary/10" asChild>
                    <Link href={`/map?lat=${pin.lat}&lng=${pin.lng}`}>
                      <Navigation className="w-5 h-5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-16">
            {isSaved ? (
              <>
                <Bookmark className="w-12 h-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-1">No saved spots yet</h3>
                <p className="text-muted-foreground text-sm">Tap the bookmark on any pin to save it here for quick access.</p>
              </>
            ) : (
              <>
                <MapPin className="w-12 h-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-1">No pins found</h3>
                <p className="text-muted-foreground text-sm">Be the first to drop a pin here!</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
