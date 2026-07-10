import React from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Save, Loader2, Plus, Trash2, X, Image as ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useGetBusiness,
  useGetMe,
  useGetBusinessAmenityKeys,
  useCustomizeBusiness,
  getGetBusinessQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { AMENITY_LABELS, AMENITY_ICONS, HIGHLIGHT_LABELS, HIGHLIGHT_ICONS } from "@/lib/business-meta";

const THEME_COLORS = [
  "#0d9488", // Teal
  "#0284c7", // Sky
  "#2563eb", // Blue
  "#4f46e5", // Indigo
  "#7c3aed", // Violet
  "#9333ea", // Purple
  "#c026d3", // Fuchsia
  "#db2777", // Pink
  "#e11d48", // Rose
  "#dc2626", // Red
  "#ea580c", // Orange
  "#d97706", // Amber
  "#ca8a04", // Yellow
  "#65a30d", // Lime
  "#16a34a", // Green
  "#059669", // Emerald
];

const FEATURED_TYPES = [
  { value: "announcement", label: "Announcement" },
  { value: "event", label: "Event" },
  { value: "special", label: "Special" },
  { value: "grand_opening", label: "Grand Opening" },
  { value: "live_music", label: "Live Music" },
  { value: "tournament", label: "Tournament" },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function BusinessCustomizePage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const businessId = Number(new URLSearchParams(search).get("id"));

  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: business, isLoading } = useGetBusiness(businessId, {
    query: { queryKey: getGetBusinessQueryKey(businessId), enabled: !!businessId },
  });
  const { data: amenityKeys = [] } = useGetBusinessAmenityKeys({
    query: { queryKey: ["business-amenity-keys"] },
  });
  const customize = useCustomizeBusiness();
  const { uploadFile } = useUpload();

  const [themeColor, setThemeColor] = React.useState<string | null>(null);
  const [featured, setFeatured] = React.useState<{ title: string; text?: string; type: any } | null>(null);
  const [highlights, setHighlights] = React.useState<any[]>([]);
  const [amenities, setAmenities] = React.useState<string[]>([]);
  const [products, setProducts] = React.useState<string[]>([]);
  const [hours, setHours] = React.useState<any>({});
  const [newProduct, setNewProduct] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadTargetIdx = React.useRef<number | null>(null);
  const [uploadingHighlightIdx, setUploadingHighlightIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (business && me) {
      if (business.userId !== me.id) {
        navigate(`/businesses/${businessId}`);
        return;
      }
      setThemeColor(business.themeColor ?? null);
      setFeatured(business.featured ?? null);
      setHighlights(business.highlights ?? []);
      setAmenities(business.amenities ?? []);
      setProducts(business.products ?? []);
      setHours(business.hoursStructured ?? {});
    }
  }, [business, me, businessId, navigate]);

  if (isLoading || !business) return <div className="p-8 text-center">Loading…</div>;

  const handleSave = () => {
    customize.mutate(
      {
        businessId,
        data: {
          themeColor,
          featured,
          highlights,
          amenities,
          products,
          hoursStructured: Object.keys(hours).length > 0 ? hours : null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
          toast.success("Profile customized");
          navigate(`/businesses/${businessId}`);
        },
        onError: () => toast.error("Failed to save changes"),
      }
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = uploadTargetIdx.current;
    if (!file || idx == null) return;
    setUploadingHighlightIdx(idx);
    try {
      const res = await uploadFile(await compressImage(file));
      if (res?.objectPath) {
        setHighlights((prev) => prev.map((h, i) => (i === idx ? { ...h, imageUrl: `/api/storage${res.objectPath}` } : h)));
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingHighlightIdx(null);
      uploadTargetIdx.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto w-full max-w-2xl p-4 pb-24 space-y-8">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate(`/businesses/${businessId}`)} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display">Customize Profile</h1>
            <p className="text-sm text-muted-foreground">{business.businessName}</p>
          </div>
          <Button onClick={handleSave} disabled={customize.isPending} data-testid="button-save-customize">
            {customize.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save
          </Button>
        </div>

        <div className="space-y-6 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div>
            <h2 className="text-lg font-semibold mb-3">Theme Color</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setThemeColor(null)}
                className={`w-10 h-10 rounded-full border-2 ${!themeColor ? "border-primary bg-muted" : "border-transparent bg-muted"} flex items-center justify-center text-xs text-muted-foreground`}
              >
                None
              </button>
              {THEME_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={`w-10 h-10 rounded-full border-2 ${themeColor === c ? "border-foreground ring-2 ring-background" : "border-transparent shadow-sm"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Featured Banner</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (featured) setFeatured(null);
                else setFeatured({ title: "", type: "announcement" });
              }}
            >
              {featured ? "Remove Banner" : "Add Banner"}
            </Button>
          </div>
          {featured && (
            <div className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={featured.type} onValueChange={(v: any) => setFeatured({ ...featured, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURED_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={featured.title} onChange={(e) => setFeatured({ ...featured, title: e.target.value })} placeholder="e.g., Live Music Tonight!" />
              </div>
              <div className="grid gap-2">
                <Label>Details (optional)</Label>
                <Input value={featured.text || ""} onChange={(e) => setFeatured({ ...featured, text: e.target.value })} placeholder="e.g., Starting at 8 PM on the patio" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Highlights</h2>
              <p className="text-sm text-muted-foreground">Up to 8 Instagram-style circles</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={highlights.length >= 8}
              onClick={() => setHighlights([...highlights, { id: crypto.randomUUID(), label: "New Highlight", icon: "events" }])}
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <div className="space-y-4">
            {highlights.map((h, idx) => (
              <div key={h.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                    {h.imageUrl ? (
                      <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="w-8 h-8 rounded-full shadow-sm"
                      disabled={uploadingHighlightIdx != null}
                      data-testid={`button-highlight-image-${idx}`}
                      onClick={() => {
                        uploadTargetIdx.current = idx;
                        fileInputRef.current?.click();
                      }}
                    >
                      {uploadingHighlightIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Input value={h.label} onChange={(e) => {
                    const newH = [...highlights];
                    newH[idx].label = e.target.value;
                    setHighlights(newH);
                  }} placeholder="Label" />
                  <Select value={h.icon} onValueChange={(v) => {
                    const newH = [...highlights];
                    newH[idx].icon = v;
                    setHighlights(newH);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(HIGHLIGHT_LABELS).map((k) => (
                        <SelectItem key={k} value={k}>{HIGHLIGHT_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => setHighlights(highlights.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {amenityKeys.map((k: string) => {
              const active = amenities.includes(k);
              const Icon = AMENITY_ICONS[k] || ImageIcon;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAmenities(active ? amenities.filter(a => a !== k) : [...amenities, k])}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active ? "bg-primary text-primary-foreground border-transparent" : "bg-background border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {AMENITY_LABELS[k] || k}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Products & Services</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {products.map((p, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
                {p}
                <button type="button" onClick={() => setProducts(products.filter((_, i) => i !== idx))} className="ml-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newProduct} onChange={e => setNewProduct(e.target.value)} placeholder="e.g., Unleaded Fuel, Live Minnows" onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newProduct.trim() && !products.includes(newProduct.trim())) {
                  setProducts([...products, newProduct.trim()]);
                  setNewProduct("");
                }
              }
            }} />
            <Button type="button" onClick={() => {
              if (newProduct.trim() && !products.includes(newProduct.trim())) {
                setProducts([...products, newProduct.trim()]);
                setNewProduct("");
              }
            }}>Add</Button>
          </div>
        </div>

        <div className="space-y-6 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Hours of Operation</h2>
          <div className="space-y-3">
            {DAYS.map(d => {
              const h = hours[d];
              return (
                <div key={d} className="flex items-center gap-3">
                  <Label className="w-16 capitalize">{d}</Label>
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={h?.open || ""}
                      onChange={e => setHours({ ...hours, [d]: e.target.value ? { open: e.target.value, close: h?.close || "" } : null })}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={h?.close || ""}
                      onChange={e => setHours({ ...hours, [d]: e.target.value ? { open: h?.open || "", close: e.target.value } : null })}
                      className="w-32"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newH = { ...hours };
                      newH[d] = null;
                      setHours(newH);
                    }}
                  >
                    Closed
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}