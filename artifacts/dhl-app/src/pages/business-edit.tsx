import React, { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowLeft, ArrowRight, Camera, X, MapPin, Trash2, LocateFixed, Store, ImagePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
  useDeleteBusiness,
  useGetBusinessTypes,
  getGetMyBusinessQueryKey,
  getGetMyBusinessesQueryKey,
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

const STEPS = ["Logo", "Cover", "Gallery", "Details", "Map pin"] as const;

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
  return <div ref={containerRef} className="h-64 w-full rounded-2xl overflow-hidden border border-border" data-testid="map-location-picker" />;
}

export default function BusinessEditPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { lakeId, lake } = useLake();

  const search = useSearch();
  const params = new URLSearchParams(search);
  const isNew = params.get("new") === "1";
  const paramId = Number(params.get("id"));

  const { data: myBusinesses = [], isLoading } = useGetMyBusinesses({
    query: { queryKey: ["my-businesses"], retry: false },
  });
  // Which business is being edited: ?new=1 always starts a blank one,
  // ?id=N edits that specific business, otherwise fall back to the oldest.
  const existing = isNew
    ? undefined
    : Number.isFinite(paramId) && paramId > 0
      ? myBusinesses.find((b) => b.id === paramId)
      : [...myBusinesses].sort((a, b) => a.id - b.id)[0];
  const { data: typeSuggestions = [] } = useGetBusinessTypes({
    query: { queryKey: ["business-types"] },
  });
  const createBiz = useCreateBusiness();
  const updateBiz = useUpdateBusiness();
  const deleteBiz = useDeleteBusiness();
  const { uploadFile, isUploading } = useUpload();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = React.useState(0);
  const [businessName, setBusinessName] = React.useState("");
  const [businessType, setBusinessType] = React.useState("");
  const [typeFocused, setTypeFocused] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [hours, setHours] = React.useState("");
  const [serviceArea, setServiceArea] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [lat, setLat] = React.useState<number | null>(null);
  const [lng, setLng] = React.useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // Which edit target the form is currently loaded for ("new" or a business
  // id). Re-populates (or blanks) the form whenever ?id / ?new changes while
  // this page stays mounted, so we never save against the wrong business.
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const target = isNew ? "new" : existing ? String(existing.id) : null;

  useEffect(() => {
    if (target == null || loadedFor === target) return;
    if (isNew || !existing) {
      setBusinessName("");
      setBusinessType("");
      setDescription("");
      setPhone("");
      setWebsite("");
      setHours("");
      setServiceArea("");
      setPhotos([]);
      setLogoUrl(null);
      setCoverUrl(null);
      setLat(null);
      setLng(null);
    } else {
      setBusinessName(existing.businessName);
      setBusinessType(existing.businessType);
      setDescription(existing.description ?? "");
      setPhone(existing.phone ?? "");
      setWebsite(existing.website ?? "");
      setHours(existing.hours ?? "");
      setServiceArea(existing.serviceArea ?? "");
      setPhotos(existing.photos ?? []);
      setLogoUrl(existing.logoUrl ?? null);
      setCoverUrl(existing.coverUrl ?? null);
      setLat(existing.lat ?? null);
      setLng(existing.lng ?? null);
    }
    setStep(0);
    setLoadedFor(target);
  }, [target, loadedFor, isNew, existing]);

  const centerLat = (lake as any)?.centerLat ?? (lake as any)?.lat ?? 34.2;
  const centerLng = (lake as any)?.centerLng ?? (lake as any)?.lng ?? -84.05;

  const typeMatches = businessType.trim()
    ? typeSuggestions.filter(
        (t) => t.toLowerCase().includes(businessType.trim().toLowerCase()) && t.toLowerCase() !== businessType.trim().toLowerCase(),
      )
    : typeSuggestions;

  const uploadSingle = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) return null;
    const res = await uploadFile(file);
    if (res?.objectPath) {
      return res.objectPath.startsWith("/api/storage") ? res.objectPath : `/api/storage${res.objectPath}`;
    }
    toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" });
    return null;
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadSingle(file);
    if (url) setLogoUrl(url);
  };

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadSingle(file);
    if (url) setCoverUrl(url);
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      if (photos.length >= 10) break;
      const url = await uploadSingle(file);
      if (url) setPhotos((prev) => (prev.length >= 10 ? prev : [...prev, url]));
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

  const detailsValid = businessName.trim().length > 0 && businessType.trim().length > 0;

  const handleSave = () => {
    if (!detailsValid) {
      setStep(3);
      toast({ title: "Missing info", description: "Business name and type are required.", variant: "destructive" });
      return;
    }
    const data = {
      businessName: businessName.trim(),
      businessType: businessType.trim(),
      description: description.trim() || null,
      logoUrl: logoUrl,
      coverUrl: coverUrl,
      phone: phone.trim() || null,
      website: website.trim() || null,
      hours: hours.trim() || null,
      serviceArea: serviceArea.trim() || null,
      photos,
      lat,
      lng,
      lakeId,
    } as any;
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: getGetMyBusinessesQueryKey() });
      qc.invalidateQueries({ queryKey: ["my-businesses"] });
      qc.invalidateQueries({ queryKey: getGetMyBusinessQueryKey() });
      qc.invalidateQueries({ queryKey: ["my-business"] });
      qc.invalidateQueries({ queryKey: getGetBusinessesQueryKey() });
      qc.invalidateQueries({ queryKey: ["businesses"] });
    };
    const callbacks = {
      onSuccess: (saved: any) => {
        invalidateAll();
        toast({
          title: existing ? "Business updated" : "Business submitted",
          description: "Your profile is pending review. It will go public once an admin approves it.",
        });
        navigate(saved?.id ? `/businesses/${saved.id}` : "/businesses");
      },
      onError: (err: any) =>
        toast({
          title: "Could not save",
          description: err?.data?.error ?? err?.message ?? undefined,
          variant: "destructive",
        }),
    };
    if (existing) {
      updateBiz.mutate({ businessId: existing.id, data }, callbacks);
    } else {
      createBiz.mutate({ data }, callbacks);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    deleteBiz.mutate({ businessId: existing.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyBusinessesQueryKey() });
        qc.invalidateQueries({ queryKey: ["my-businesses"] });
        qc.invalidateQueries({ queryKey: getGetMyBusinessQueryKey() });
        qc.invalidateQueries({ queryKey: ["my-business"] });
        qc.invalidateQueries({ queryKey: getGetBusinessesQueryKey() });
        qc.invalidateQueries({ queryKey: ["businesses"] });
        toast({ title: "Business profile removed" });
        navigate("/businesses");
      },
      onError: () => toast({ title: "Could not delete", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    if (step === 3 && !detailsValid) {
      toast({ title: "Missing info", description: "Business name and type are required.", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl pb-28">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => (step > 0 ? setStep(step - 1) : navigate("/businesses"))}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold flex-1">{existing ? "Edit Business Profile" : "Add Your Business"}</h1>
            <span className="text-xs font-medium text-muted-foreground pr-2" data-testid="wizard-step-label">
              {step + 1} / {STEPS.length} · {STEPS[step]}
            </span>
          </div>
          {/* progress */}
          <div className="flex gap-1 px-4 pb-2">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-label={s}
                onClick={() => setStep(i)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
                data-testid={`wizard-dot-${i}`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-5">
          {existing && existing.status === "pending" && step === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">Pending Review</span> — your profile is waiting for admin approval. Any new changes will also need approval.
            </div>
          )}
          {existing && existing.status === "rejected" && step === 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              Your profile was not approved. Update it and save to resubmit for review.
            </div>
          )}

          {/* STEP 0: LOGO */}
          {step === 0 && (
            <div className="space-y-4 text-center">
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Add your logo</h2>
                <p className="text-sm text-muted-foreground">This shows next to your name across the app — like a profile picture.</p>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative"
                  data-testid="button-pick-logo"
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-32 w-32 rounded-3xl object-cover border-4 border-background shadow-md" />
                  ) : (
                    <div className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      <Store className="w-8 h-8" />
                      <span className="text-xs font-medium">{isUploading ? "Uploading…" : "Add logo"}</span>
                    </div>
                  )}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoPick} />
              </div>
              {logoUrl && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLogoUrl(null)}>
                  <X className="w-4 h-4 mr-1.5" /> Remove logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">You can skip this and add it later.</p>
            </div>
          )}

          {/* STEP 1: COVER */}
          {step === 1 && (
            <div className="space-y-4 text-center">
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Add a cover photo</h2>
                <p className="text-sm text-muted-foreground">A wide photo shown at the top of your business profile.</p>
              </div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploading}
                className="block w-full"
                data-testid="button-pick-cover"
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="h-44 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-xs font-medium">{isUploading ? "Uploading…" : "Add cover photo"}</span>
                  </div>
                )}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverPick} />
              {coverUrl && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setCoverUrl(null)}>
                  <X className="w-4 h-4 mr-1.5" /> Remove cover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">You can skip this and add it later.</p>
            </div>
          )}

          {/* STEP 2: GALLERY */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-bold">Show off your work</h2>
                <p className="text-sm text-muted-foreground">Add up to 10 photos — your storefront, boats, docks, happy customers.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={p} alt="" className="h-full w-full rounded-xl object-cover" />
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
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    data-testid="button-add-photo"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px]">{isUploading ? "Uploading…" : "Add"}</span>
                  </button>
                )}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoPick} />
            </div>
          )}

          {/* STEP 3: DETAILS */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-bold">Tell people about your business</h2>
                <p className="text-sm text-muted-foreground">Name and type are required — everything else helps customers find you.</p>
              </div>

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
            </div>
          )}

          {/* STEP 4: MAP PIN */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-bold">Drop your pin on the map</h2>
                <p className="text-sm text-muted-foreground">This puts your business on the lake map so people can find you.</p>
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={useCurrentLocation}>
                  <LocateFixed className="w-4 h-4 mr-1.5" /> Use my location
                </Button>
              </div>
              <LocationPicker lat={lat} lng={lng} centerLat={centerLat} centerLng={centerLng} onPick={(a, b) => { setLat(a); setLng(b); }} />
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                <MapPin className="w-3 h-3" />
                {lat != null && lng != null
                  ? `Pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)} — tap the map to move it.`
                  : "Tap the map to drop your business pin. It goes public after admin approval."}
              </p>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSave}
                disabled={createBiz.isPending || updateBiz.isPending || isUploading}
                data-testid="button-save-business"
              >
                {createBiz.isPending || updateBiz.isPending ? "Saving…" : existing ? "Save & resubmit for review" : "Submit for review"}
              </Button>

              {existing && (
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} data-testid="button-delete-business">
                  <Trash2 className="w-4 h-4 mr-2" /> Remove business profile
                </Button>
              )}
            </div>
          )}

          {!isLast && (
            <Button className="w-full" size="lg" onClick={goNext} disabled={isUploading} data-testid="button-wizard-next">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your business profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile, followers, and reviews will be removed from the app and the map. This can't be undone.
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
