import React, { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowLeft, Camera, X, MapPin, Trash2, LocateFixed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyBusiness,
  useUpsertMyBusiness,
  useDeleteMyBusiness,
  useGetBusinessTypes,
  getGetMyBusinessQueryKey,
  getGetBusinessesQueryKey,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLake } from "@/lib/lake-context";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function LocationPicker({
  lat,
  lng,
  centerLat,
  centerLng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  centerLat: number;
  centerLng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [mapFailed, setMapFailed] = React.useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [lng ?? centerLng, lat ?? centerLat],
        zoom: lat != null ? 13 : 10,
        attributionControl: false,
      });
    } catch {
      // WebGL unavailable (old device / headless browser) — fall back to the
      // "use my location" button instead of crashing the whole form.
      setMapFailed(true);
      return;
    }
    mapRef.current = map;
    map.on("click", (e) => {
      onPickRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: "#0d9488" }).setLngLat([lng, lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [lat, lng]);

  if (mapFailed) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground px-4 text-center" data-testid="map-location-picker">
        Map preview unavailable on this device — use the "Use my location" button to set your pin.
      </div>
    );
  }
  return <div ref={containerRef} className="h-52 w-full rounded-2xl overflow-hidden border border-border" data-testid="map-location-picker" />;
}

export default function BusinessEditPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { lakeId, lake } = useLake();

  const { data: existing, isLoading } = useGetMyBusiness({
    query: { queryKey: ["my-business"], retry: false },
  });
  const { data: typeSuggestions = [] } = useGetBusinessTypes({
    query: { queryKey: ["business-types"] },
  });
  const upsert = useUpsertMyBusiness();
  const deleteBusiness = useDeleteMyBusiness();
  const { uploadFile, isUploading } = useUpload();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = React.useState("");
  const [businessType, setBusinessType] = React.useState("");
  const [typeFocused, setTypeFocused] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [hours, setHours] = React.useState("");
  const [serviceArea, setServiceArea] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [lat, setLat] = React.useState<number | null>(null);
  const [lng, setLng] = React.useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setBusinessName(existing.businessName);
      setBusinessType(existing.businessType);
      setDescription(existing.description ?? "");
      setPhone(existing.phone ?? "");
      setWebsite(existing.website ?? "");
      setHours(existing.hours ?? "");
      setServiceArea(existing.serviceArea ?? "");
      setPhotos(existing.photos ?? []);
      setLat(existing.lat ?? null);
      setLng(existing.lng ?? null);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const centerLat = (lake as any)?.centerLat ?? (lake as any)?.lat ?? 34.2;
  const centerLng = (lake as any)?.centerLng ?? (lake as any)?.lng ?? -84.05;

  const typeMatches = businessType.trim()
    ? typeSuggestions.filter(
        (t) => t.toLowerCase().includes(businessType.trim().toLowerCase()) && t.toLowerCase() !== businessType.trim().toLowerCase(),
      )
    : typeSuggestions;

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (photos.length >= 10) break;
      const res = await uploadFile(file);
      if (res?.objectPath) {
        const url = res.objectPath.startsWith("/api/storage") ? res.objectPath : `/api/storage${res.objectPath}`;
        setPhotos((prev) => (prev.length >= 10 ? prev : [...prev, url]));
      } else {
        toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" });
      }
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => toast({ title: "Could not get your location", variant: "destructive" }),
      { timeout: 8000 },
    );
  };

  const handleSave = () => {
    if (!businessName.trim() || !businessType.trim()) {
      toast({ title: "Missing info", description: "Business name and type are required.", variant: "destructive" });
      return;
    }
    upsert.mutate(
      {
        data: {
          businessName: businessName.trim(),
          businessType: businessType.trim(),
          description: description.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          hours: hours.trim() || null,
          serviceArea: serviceArea.trim() || null,
          photos,
          lat,
          lng,
          lakeId,
        } as any,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyBusinessQueryKey() });
          qc.invalidateQueries({ queryKey: ["my-business"] });
          qc.invalidateQueries({ queryKey: getGetBusinessesQueryKey() });
          qc.invalidateQueries({ queryKey: ["businesses"] });
          toast({
            title: existing ? "Business updated" : "Business submitted",
            description: "Your listing is pending review. It will go public once an admin approves it.",
          });
          navigate("/businesses");
        },
        onError: () => toast({ title: "Could not save", variant: "destructive" }),
      },
    );
  };

  const handleDelete = () => {
    deleteBusiness.mutate(undefined as any, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyBusinessQueryKey() });
        qc.invalidateQueries({ queryKey: ["my-business"] });
        qc.invalidateQueries({ queryKey: getGetBusinessesQueryKey() });
        qc.invalidateQueries({ queryKey: ["businesses"] });
        qc.removeQueries({ queryKey: ["my-business"] });
        toast({ title: "Business profile removed" });
        navigate("/businesses");
      },
      onError: () => toast({ title: "Could not delete", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl pb-24">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur px-2 py-2 border-b border-border">
          <Button size="icon" variant="ghost" onClick={() => navigate("/businesses")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold flex-1">{existing ? "My Business" : "Add Your Business"}</h1>
        </div>

        <div className="p-4 space-y-5">
          {existing && existing.status === "pending" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">Pending Review</span> — your listing is waiting for admin approval. Any new changes will also need approval.
            </div>
          )}
          {existing && existing.status === "rejected" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              Your listing was not approved. Update it and save to resubmit for review.
            </div>
          )}
          {!existing && (
            <p className="text-sm text-muted-foreground">
              Run a business on or around the lake? Fill out your profile below. After you submit, an admin will
              review it before it appears publicly in the Businesses tab and on the map.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="biz-name">Business name *</Label>
            <Input id="biz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Sunset Marina" maxLength={80} data-testid="input-business-name" />
          </div>

          <div className="space-y-1.5 relative">
            <Label htmlFor="biz-type">Business type *</Label>
            <Input
              id="biz-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              onFocus={() => setTypeFocused(true)}
              onBlur={() => setTimeout(() => setTypeFocused(false), 150)}
              placeholder="e.g. Marina, Fishing Guide, Boat Rental…"
              maxLength={60}
              autoComplete="off"
              data-testid="input-business-type"
            />
            {typeFocused && typeMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                {typeMatches.slice(0, 12).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setBusinessType(t);
                      setTypeFocused(false);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Pick a suggestion or type your own.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="biz-desc">Description</Label>
            <Textarea id="biz-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What do you offer? Services, pricing, how to book…" rows={4} maxLength={2000} data-testid="input-business-description" />
          </div>

          <div className="space-y-1.5">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 10 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="button-add-photo"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px]">{isUploading ? "Uploading…" : "Add"}</span>
                </button>
              )}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoPick} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="biz-phone">Phone</Label>
              <Input id="biz-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" maxLength={30} data-testid="input-business-phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-website">Website</Label>
              <Input id="biz-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.example.com" maxLength={200} data-testid="input-business-website" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="biz-hours">Hours</Label>
            <Textarea id="biz-hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={"Mon–Fri 8am–6pm\nSat–Sun 7am–8pm"} rows={2} maxLength={500} data-testid="input-business-hours" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="biz-area">Service area (optional)</Label>
            <Input id="biz-area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Whole lake, north shore, dockside delivery" maxLength={200} data-testid="input-business-service-area" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Location pin</Label>
              <Button type="button" size="sm" variant="ghost" onClick={useCurrentLocation}>
                <LocateFixed className="w-4 h-4 mr-1.5" /> Use my location
              </Button>
            </div>
            <LocationPicker lat={lat} lng={lng} centerLat={centerLat} centerLng={centerLng} onPick={(a, b) => { setLat(a); setLng(b); }} />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {lat != null && lng != null
                ? `Pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)} — tap the map to move it.`
                : "Tap the map to drop your business pin. It goes public after admin approval."}
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSave}
            disabled={upsert.isPending || isUploading}
            data-testid="button-save-business"
          >
            {upsert.isPending ? "Saving…" : existing ? "Save & resubmit for review" : "Submit for review"}
          </Button>

          {existing && (
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} data-testid="button-delete-business">
              <Trash2 className="w-4 h-4 mr-2" /> Remove business profile
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your business profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Your listing will be removed from the Businesses tab and the map. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
