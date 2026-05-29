import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useGetMe, useGetFriendLocations, useGetPins, useUpdateMyLocation, useCreatePin, getGetPinsQueryKey } from "@workspace/api-client-react";
import { PinType, PinInputType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Navigation, MessageSquare, Plus, Crosshair, ChevronUp, Droplet } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedPage } from "./feed";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";

// --- Leaflet setup ---

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createBoatIcon = (color: string) => {
  return L.divIcon({
    className: 'boat-icon-container',
    html: `<div class="boat-marker animate-bob" style="background-color: ${color || '#0284c7'}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M20 12v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/><path d="M12 12v-6"/><path d="M12 6l5 6"/><path d="M12 6L7 12"/></svg>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const getPinEmoji = (type: string) => {
  switch (type) {
    case 'fishing_spot': return '🎣';
    case 'cliff': return '🏔️';
    case 'waterfall': return '💧';
    case 'landmark': return '📍';
    case 'hazard': return '⚠️';
    case 'marina': return '⛵';
    case 'campsite': return '🏕️';
    default: return '📍';
  }
};

const formatPinWindow = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime && !endTime) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (startTime && endTime) return `${fmt(startTime)} - ${fmt(endTime)}`;
  if (startTime) return `From ${fmt(startTime)}`;
  return `Until ${fmt(endTime!)}`;
};

const getPinColor = (type: string) => {
  switch (type) {
    case 'fishing_spot': return 'bg-blue-500';
    case 'cliff': return 'bg-slate-500';
    case 'waterfall': return 'bg-cyan-500';
    case 'landmark': return 'bg-primary';
    case 'hazard': return 'bg-destructive';
    case 'marina': return 'bg-emerald-500';
    case 'campsite': return 'bg-amber-600';
    default: return 'bg-primary';
  }
};

const createPinIcon = (type: string) => {
  const emoji = getPinEmoji(type);
  const color = getPinColor(type);
  return L.divIcon({
    className: 'custom-pin',
    html: `<div class="w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-md border-2 border-white ${color}">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

function LocationUpdater() {
  const { data: me } = useGetMe();
  const updateLocation = useUpdateMyLocation();
  
  useEffect(() => {
    if (!me || !me.shareLocation) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        updateLocation.mutate({
          data: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
        });
      });
    }
  }, [me?.shareLocation]);

  return null;
}

function MapEvents({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e);
    }
  });
  return null;
}

export function MapPage() {
  const { data: me } = useGetMe();
  const { data: friends } = useGetFriendLocations();
  const { data: pins } = useGetPins({});
  const createPin = useCreatePin();
  const queryClient = useQueryClient();
  
  const center: [number, number] = [36.53, -85.37];
  
  const [pinDialog, setPinDialog] = useState<{ open: boolean; lat?: number; lng?: number }>({ open: false });
  const [pinTitle, setPinTitle] = useState("");
  const [pinDesc, setPinDesc] = useState("");
  const [pinType, setPinType] = useState<PinInputType>("fishing_spot");
  const [pinVisibility, setPinVisibility] = useState<"friends" | "public" | "community">("friends");
  const [pinStart, setPinStart] = useState("");
  const [pinEnd, setPinEnd] = useState("");
  
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    // We could drop a temporary pin here, but let's just open the dialog for simplicity
    // or we could ignore map clicks and only use the FAB
  };

  const handleFabClick = () => {
    // Normally we'd use current location, for now use center or current if available
    let lat = center[0];
    let lng = center[1];
    
    if (me?.currentLat && me?.currentLng) {
      lat = me.currentLat;
      lng = me.currentLng;
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPinDialog({ open: true, lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
      return;
    }
    
    setPinDialog({ open: true, lat, lng });
  };

  const submitPin = () => {
    if (!pinDialog.lat || !pinDialog.lng) return;
    
    createPin.mutate({
      data: {
        title: pinTitle || "New Spot",
        description: pinDesc,
        type: pinType,
        lat: pinDialog.lat,
        lng: pinDialog.lng,
        visibility: pinVisibility,
        startTime: pinStart ? new Date(pinStart).toISOString() : null,
        endTime: pinEnd ? new Date(pinEnd).toISOString() : null,
      }
    }, {
      onSuccess: () => {
        toast.success(
          pinVisibility === "community"
            ? "Community pin submitted for approval."
            : "Pin dropped successfully!"
        );
        setPinDialog({ open: false });
        setPinTitle("");
        setPinDesc("");
        setPinVisibility("friends");
        setPinStart("");
        setPinEnd("");
        queryClient.invalidateQueries({ queryKey: getGetPinsQueryKey({}) });
      }
    });
  };

  return (
    <div className="h-full w-full relative bg-blue-50">
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container { height: 100%; width: 100%; }
        .boat-marker {
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 10% 50%;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .boat-marker svg {
          transform: rotate(45deg);
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bob {
          animation: bob 3s ease-in-out infinite;
        }
        .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
        .leaflet-popup-content { margin: 8px 12px; }
      `}} />
      
      {me && (
        <Link
          href="/profile/me"
          className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border rounded-full pl-1.5 pr-3.5 py-1.5 shadow-lg hover:bg-card transition-colors no-underline text-inherit"
        >
          <UserAvatar name={me.displayName} username={me.username} avatarUrl={me.avatarUrl} online={me.isOnline} className="w-8 h-8" />
          <div className="leading-tight">
            <div className="text-xs font-bold">{me.displayName}</div>
            <div className="text-[10px] text-muted-foreground">View profile</div>
          </div>
        </Link>
      )}

      <MapContainer 
        center={center} 
        zoom={12} 
        zoomControl={false}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        <ZoomControl position="topright" />
        
        <LocationUpdater />
        <MapEvents onMapClick={handleMapClick} />
        
        {/* Friends */}
        {friends?.map(friend => {
          if (!friend.lat || !friend.lng) return null;
          return (
            <Marker 
              key={friend.userId} 
              position={[friend.lat, friend.lng]}
              icon={createBoatIcon(friend.boatColor || '#0ea5e9')}
            >
              <Popup>
                <div className="flex flex-col gap-2">
                  <Link href={`/profile/${friend.userId}`} className="flex items-center gap-3 no-underline text-inherit">
                    <UserAvatar name={friend.displayName} username={friend.username} avatarUrl={friend.avatarUrl} online={friend.isOnline} className="w-10 h-10" />
                    <div>
                      <h3 className="font-bold text-base leading-tight">{friend.displayName}</h3>
                      <p className="text-xs text-muted-foreground">{friend.boatName || 'No boat name'}</p>
                    </div>
                  </Link>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="default" className="flex-1 text-xs h-8 bg-primary hover:bg-primary/90" asChild>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${friend.lat},${friend.lng}`} target="_blank" rel="noreferrer">
                        <Navigation className="w-3 h-3 mr-1" /> Nav
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-8" asChild>
                      <Link href={`/messages?user=${friend.userId}`}>
                        <MessageSquare className="w-3 h-3 mr-1" /> Chat
                      </Link>
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Pins */}
        {pins?.map(pin => (
          <Marker 
            key={pin.id} 
            position={[pin.lat, pin.lng]}
            icon={createPinIcon(pin.type)}
          >
            <Popup>
              <div className="flex flex-col min-w-[150px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{getPinEmoji(pin.type)}</span>
                  <h3 className="font-bold">{pin.title}</h3>
                </div>
                {pin.description && <p className="text-sm text-muted-foreground">{pin.description}</p>}
                {(pin.startTime || pin.endTime) && (
                  <p className="text-xs text-primary font-medium mt-1">
                    {formatPinWindow(pin.startTime, pin.endTime)}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] text-muted-foreground uppercase">By {pin.user?.displayName || 'Unknown'}</p>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" asChild>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer">
                      <Navigation className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Me */}
        {me?.shareLocation && me?.currentLat && me?.currentLng && (
          <Marker
            position={[me.currentLat, me.currentLng]}
            icon={createBoatIcon(me.boatColor || '#0284c7')}
          >
            <Popup>
              <div className="font-bold text-center">You are here</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      {/* Floating Action Button for Pins */}
      <div className="absolute top-[80px] right-4 z-[400] flex flex-col gap-3">
        <Button size="icon" className="h-12 w-12 rounded-full shadow-lg bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleFabClick}>
          <Plus className="h-6 w-6" />
        </Button>
        <Button size="icon" className="h-12 w-12 rounded-full shadow-lg bg-card text-foreground hover:bg-muted" onClick={() => {
            if (me?.currentLat && me?.currentLng) {
               // A real app would pan to location here, but useMap isn't accessible outside MapContainer easily without context sharing
            }
          }}>
          <Crosshair className="h-5 w-5" />
        </Button>
      </div>

      {/* Floating Bottom Drawer / Panel */}
      <Sheet>
        <SheetTrigger asChild>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-sm">
            <Button variant="outline" className="w-full rounded-full shadow-lg bg-card/90 backdrop-blur-sm border-border h-12 flex items-center justify-between px-6 hover:bg-card">
              <span className="font-semibold flex items-center gap-2">
                <Droplet className="w-4 h-4 text-primary fill-primary" /> Lake Feed
              </span>
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-3xl overflow-hidden flex flex-col bg-background border-border">
          <div className="w-12 h-1.5 bg-muted mx-auto rounded-full mt-3 mb-2 shrink-0" />
          <SheetHeader className="px-4 text-left shrink-0 pb-2">
            <SheetTitle className="sr-only">Lake Feed</SheetTitle>
            <SheetDescription className="sr-only">Community activity on the lake</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto w-full relative">
            {/* Render the feed page directly inside the sheet for immediate access */}
            <div className="absolute inset-0">
              <FeedPage />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Pin Creation Dialog */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => !open && setPinDialog({ open: false })}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Drop a Pin</DialogTitle>
            <DialogDescription>Mark a spot on the lake for others to see.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={pinType} onValueChange={(v: PinInputType) => setPinType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fishing_spot">🎣 Fishing Spot</SelectItem>
                  <SelectItem value="cliff">🏔️ Cliff Jumping</SelectItem>
                  <SelectItem value="waterfall">💧 Waterfall</SelectItem>
                  <SelectItem value="campsite">🏕️ Campsite</SelectItem>
                  <SelectItem value="marina">⛵ Marina</SelectItem>
                  <SelectItem value="hazard">⚠️ Hazard</SelectItem>
                  <SelectItem value="landmark">📍 Landmark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input 
                id="title" 
                placeholder="e.g. Great Bass Spot" 
                value={pinTitle}
                onChange={e => setPinTitle(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="desc">Description (Optional)</Label>
              <Textarea 
                id="desc" 
                placeholder="Any tips or warnings?" 
                value={pinDesc}
                onChange={e => setPinDesc(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="grid gap-2">
              <Label>Who can see this?</Label>
              <Select value={pinVisibility} onValueChange={(v: "friends" | "public" | "community") => setPinVisibility(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friends">Friends only</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="community">Community (needs approval)</SelectItem>
                </SelectContent>
              </Select>
              {pinVisibility === "friends" && (
                <p className="text-xs text-muted-foreground">Only your friends and people viewing your profile will see this pin.</p>
              )}
              {pinVisibility === "public" && (
                <p className="text-xs text-muted-foreground">Everyone on the lake can see this pin.</p>
              )}
              {pinVisibility === "community" && (
                <p className="text-xs text-muted-foreground">Goes live for everyone once an admin approves it.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="start">Starts (Optional)</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={pinStart}
                  onChange={e => setPinStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">Ends (Optional)</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={pinEnd}
                  onChange={e => setPinEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialog({ open: false })}>Cancel</Button>
            <Button onClick={submitPin} disabled={!pinTitle || createPin.isPending}>
              {pinVisibility === "community" ? "Submit Pin" : "Drop Pin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
