import React, { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useUpdateMe,
  useGetMyBoats,
  useCreateBoat,
  useUpdateBoat,
  useDeleteBoat,
  useSetPrimaryBoat,
  getGetMyBoatsQueryKey,
  getGetMeQueryKey,
  type Boat,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { Save, Camera, Loader2, Trash2, Plus, Star, Pencil, ArrowLeft, Anchor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { getCroppedImageFile, type CropArea } from "@/lib/cropImage";
import { resolveAvatarUrl } from "@/components/UserAvatar";
import { boatSvgFor, boatLabelFor, FLAG_SVG, BOAT_TYPES, BOAT_BRANDS, BOAT_BRAND_MAX_LENGTH } from "../boats";
import { SettingsShell } from "@/components/settings-ui";

const BOAT_COLORS = [
  { value: '#0ea5e9', label: 'Sky Blue' },
  { value: '#0284c7', label: 'Deep Lake' },
  { value: '#1d4ed8', label: 'Royal Blue' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#22c55e', label: 'Green' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#f59e0b', label: 'Sun Gold' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Red Wake' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#d946ef', label: 'Magenta' },
  { value: '#8b5cf6', label: 'Dusk Purple' },
  { value: '#334155', label: 'Slate' },
  { value: '#0f172a', label: 'Midnight' },
  { value: '#78716c', label: 'Stone' },
  { value: '#f8fafc', label: 'White' }
];

export function BoatPreview({ type, color, neon, flag, accent, scale = 1 }: { type: string; color: string; neon?: boolean; flag?: boolean; accent?: string | null; scale?: number }) {
  const accentColor = accent || color;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: 84 * scale, height: 56 * scale, color }}>
      {neon && (
        <span
          className="absolute rounded-full"
          style={{ width: 56 * scale, height: 14 * scale, bottom: 8 * scale, background: accentColor, filter: "blur(7px)", opacity: 0.8 }}
        />
      )}
      <span
        className="relative"
        style={{ color, lineHeight: 0, filter: "drop-shadow(0 4px 4px rgba(11,58,91,0.28))", transform: scale !== 1 ? `scale(${scale})` : undefined }}
        dangerouslySetInnerHTML={{ __html: boatSvgFor(type) }}
      />
      {flag && (
        <span
          className="absolute"
          style={{ color: accentColor, left: 8 * scale, top: 0, lineHeight: 0, transform: scale !== 1 ? `scale(${scale})` : undefined }}
          dangerouslySetInnerHTML={{ __html: FLAG_SVG }}
        />
      )}
    </span>
  );
}

type EditorState = {
  id: number | null; // null = adding a new boat
  name: string;
  boatType: string;
  color: string;
  brand: string;
  model: string;
  year: string;
  photoUrl: string | null;
  neon: boolean;
  flag: boolean;
  accent: string;
  notes: string;
  horsepower: string;
  engineInfo: string;
  lengthFt: string;
  favoriteMarina: string;
  favoriteCove: string;
  favoriteActivity: string;
  mods: string;
};

function editorFromBoat(b: Boat | null): EditorState {
  return {
    id: b?.id ?? null,
    name: b?.name ?? "",
    boatType: b?.boatType ?? "speedboat",
    color: b?.color ?? "#0ea5e9",
    brand: b?.brand ?? "",
    model: b?.model ?? "",
    year: b?.year ? String(b.year) : "",
    photoUrl: b?.photoUrl ?? null,
    neon: b?.neon ?? false,
    flag: b?.flag ?? false,
    accent: b?.accent ?? "",
    notes: b?.notes ?? "",
    horsepower: b?.horsepower ? String(b.horsepower) : "",
    engineInfo: (b as any)?.engineInfo ?? "",
    lengthFt: (b as any)?.lengthFt ? String((b as any).lengthFt) : "",
    favoriteMarina: (b as any)?.favoriteMarina ?? "",
    favoriteCove: (b as any)?.favoriteCove ?? "",
    favoriteActivity: (b as any)?.favoriteActivity ?? "",
    mods: (b as any)?.mods ?? "",
  };
}

export function VesselDetailsPage() {
  const { data: me, isLoading } = useGetMe();
  const { data: fleet = [], isLoading: fleetLoading } = useGetMyBoats();
  const updateMe = useUpdateMe();
  const createBoat = useCreateBoat();
  const updateBoat = useUpdateBoat();
  const deleteBoat = useDeleteBoat();
  const setPrimaryBoat = useSetPrimaryBoat();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showBoat, setShowBoat] = React.useState(true);
  const [homeMarina, setHomeMarina] = React.useState("");
  const [editor, setEditor] = React.useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Boat | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [cropFileName, setCropFileName] = React.useState("boat.jpg");
  const [cropping, setCropping] = React.useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const photoUpload = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" }),
  });

  useEffect(() => {
    if (me) {
      setShowBoat((me as any).showBoat ?? true);
      setHomeMarina((me as any).homeMarina || "");
    }
  }, [me]);

  const cropSrcRef = useRef<string | null>(null);
  cropSrcRef.current = cropSrc;
  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);

  const refreshFleet = () => {
    qc.invalidateQueries({ queryKey: getGetMyBoatsQueryKey() });
    // Primary boat changes flow onto the profile/map via users.boat* fields.
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const saveShowBoat = (next: boolean) => {
    setShowBoat(next);
    updateMe.mutate({ data: { showBoat: next } as any }, {
      onError: () => {
        setShowBoat(!next);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const saveHomeMarina = () => {
    updateMe.mutate({ data: { homeMarina: homeMarina.trim() || null } as any }, {
      onSuccess: () => toast({ title: "Home marina saved" }),
      onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
    });
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropFileName(file.name);
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCropConfirm = async (area: CropArea) => {
    if (!cropSrc || !editor) return;
    setCropping(true);
    try {
      const cropped = await getCroppedImageFile(cropSrc, area, cropFileName);
      const res = await photoUpload.uploadFile(await compressImage(cropped));
      if (!res?.objectPath) return;
      setEditor({ ...editor, photoUrl: res.objectPath });
      closeCrop();
    } catch {
      toast({ title: "Could not process image", description: "Please try a different photo.", variant: "destructive" });
    } finally {
      setCropping(false);
    }
  };

  const handleSaveBoat = () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      toast({ title: "Name your boat", description: "Every boat needs a name.", variant: "destructive" });
      return;
    }
    const yearTrimmed = editor.year.trim();
    const yearNum = yearTrimmed ? Number(yearTrimmed) : null;
    if (yearTrimmed && (!Number.isInteger(yearNum) || yearNum! < 1900 || yearNum! > new Date().getFullYear() + 1)) {
      toast({ title: "Check the year", description: "Please enter a valid year (e.g. 2019).", variant: "destructive" });
      return;
    }
    const payload = {
      name: editor.name.trim(),
      boatType: editor.boatType,
      color: editor.color,
      brand: editor.brand.trim() || null,
      model: editor.model.trim() || null,
      year: yearNum,
      photoUrl: editor.photoUrl,
      neon: editor.neon,
      flag: editor.flag,
      accent: editor.accent || null,
      notes: editor.notes.trim() || null,
      horsepower: editor.horsepower.trim() ? Number(editor.horsepower.trim()) : null,
      engineInfo: editor.engineInfo.trim() || null,
      lengthFt: editor.lengthFt.trim() ? Number(editor.lengthFt.trim()) : null,
      favoriteMarina: editor.favoriteMarina.trim() || null,
      favoriteCove: editor.favoriteCove.trim() || null,
      favoriteActivity: editor.favoriteActivity.trim() || null,
      mods: editor.mods.trim() || null,
    };
    const opts = {
      onSuccess: () => {
        refreshFleet();
        setEditor(null);
        toast({ title: editor.id ? "Boat updated" : "Boat added to your fleet" });
      },
      onError: () => toast({ title: "Error", description: "Failed to save boat.", variant: "destructive" }),
    };
    if (editor.id) {
      updateBoat.mutate({ boatId: editor.id, data: payload }, opts);
    } else {
      createBoat.mutate({ data: payload }, opts);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteBoat.mutate({ boatId: deleteTarget.id }, {
      onSuccess: () => {
        refreshFleet();
        setDeleteTarget(null);
        toast({ title: "Boat removed", description: "Its photos stay in your gallery." });
      },
      onError: () => toast({ title: "Error", description: "Failed to remove boat.", variant: "destructive" }),
    });
  };

  const handleSetPrimary = (b: Boat) => {
    setPrimaryBoat.mutate({ boatId: b.id }, {
      onSuccess: () => {
        refreshFleet();
        toast({ title: `${b.name} is now your Primary Boat`, description: "It's what friends see on your profile and the map." });
      },
      onError: () => toast({ title: "Error", description: "Failed to set primary boat.", variant: "destructive" }),
    });
  };

  if (isLoading || fleetLoading) {
    return (
      <SettingsShell title="My Fleet">
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      </SettingsShell>
    );
  }

  // ---------- Editor view (add / edit one boat) ----------
  if (editor) {
    const resolvedPhoto = resolveAvatarUrl(editor.photoUrl);
    const saving = createBoat.isPending || updateBoat.isPending;
    const editorAction = (
      <Button size="sm" onClick={handleSaveBoat} disabled={saving} data-testid="button-save-boat">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save
      </Button>
    );
    return (
      <SettingsShell title={editor.id ? "Edit Boat" : "Add to Fleet"} action={editorAction}>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
        <ImageCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          aspect={16 / 9}
          cropShape="rect"
          title="Adjust boat photo"
          busy={cropping}
          onCancel={closeCrop}
          onConfirm={handleCropConfirm}
        />

        <button
          type="button"
          onClick={() => setEditor(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          data-testid="button-back-to-fleet"
        >
          <ArrowLeft className="w-4 h-4" /> Back to fleet
        </button>

        <div className="rounded-2xl bg-card border border-border p-4 space-y-5">
          {/* Boat photo */}
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="relative overflow-hidden rounded-xl border border-border bg-muted aspect-video">
              {resolvedPhoto ? (
                <img src={resolvedPhoto} alt="Boat" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <Camera className="w-6 h-6" />
                  <span className="text-xs">Show off the real thing</span>
                </div>
              )}
              <div className="absolute bottom-2 right-2 flex gap-2">
                {editor.photoUrl && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditor({ ...editor, photoUrl: null })} data-testid="button-remove-boat-photo">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button type="button" size="sm" variant="secondary" onClick={() => photoRef.current?.click()} disabled={photoUpload.isUploading} data-testid="button-upload-boat-photo">
                  {photoUpload.isUploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
                  {editor.photoUrl ? "Change photo" : "Add photo"}
                </Button>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-border bg-gradient-to-b from-sky-100 to-sky-200 p-4 flex flex-col items-center gap-1">
            <div className="flex items-center justify-center h-14">
              <BoatPreview type={editor.boatType} color={editor.color || "#0ea5e9"} neon={editor.neon} flag={editor.flag} accent={editor.accent || undefined} />
            </div>
            <span className="text-xs font-medium text-slate-600">{editor.name || "Your boat on the lake"}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="boatName">Name</Label>
            <Input id="boatName" value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} maxLength={60} placeholder="e.g. Wake Maker" className="bg-background" data-testid="input-boat-name" />
          </div>

          {/* Boat type */}
          <div className="space-y-3">
            <Label>Style</Label>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-2.5">
              {BOAT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEditor({ ...editor, boatType: t.value })}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 transition-all ${editor.boatType === t.value ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}
                >
                  <BoatPreview type={t.value} color={editor.color || "#0ea5e9"} />
                  <span className="text-xs font-semibold leading-tight">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label htmlFor="boatBrand">Brand / Manufacturer <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="boatBrand"
              list="boat-brand-suggestions"
              value={editor.brand}
              onChange={e => setEditor({ ...editor, brand: e.target.value })}
              maxLength={BOAT_BRAND_MAX_LENGTH}
              placeholder="e.g. MasterCraft, Ranger, Fountain"
              className="bg-background"
              data-testid="input-boat-brand"
            />
            <datalist id="boat-brand-suggestions">
              {BOAT_BRANDS.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>

          {/* Model + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="boatModel">Model <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="boatModel"
                value={editor.model}
                onChange={e => setEditor({ ...editor, model: e.target.value })}
                maxLength={60}
                placeholder="e.g. 38 Lightning"
                className="bg-background"
                data-testid="input-boat-model"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="boatYear">Year <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="boatYear"
                value={editor.year}
                onChange={e => setEditor({ ...editor, year: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                inputMode="numeric"
                placeholder="e.g. 2019"
                className="bg-background"
                data-testid="input-boat-year"
              />
            </div>
          </div>

          {/* Specs: length / horsepower / engine */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="boatLength">Length (ft) <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="boatLength"
                value={editor.lengthFt}
                onChange={e => setEditor({ ...editor, lengthFt: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })}
                inputMode="numeric"
                placeholder="e.g. 24"
                className="bg-background"
                data-testid="input-boat-length"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="boatHp">Horsepower <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="boatHp"
                value={editor.horsepower}
                onChange={e => setEditor({ ...editor, horsepower: e.target.value.replace(/[^0-9]/g, "").slice(0, 5) })}
                inputMode="numeric"
                placeholder="e.g. 350"
                className="bg-background"
                data-testid="input-boat-horsepower"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="boatEngine">Engine <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="boatEngine"
              value={editor.engineInfo}
              onChange={e => setEditor({ ...editor, engineInfo: e.target.value.slice(0, 100) })}
              placeholder="e.g. Twin Mercury 400R"
              className="bg-background"
              data-testid="input-boat-engine"
            />
          </div>

          {/* Favorites */}
          <div className="space-y-2">
            <Label htmlFor="boatFavMarina">Favorite Marina <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="boatFavMarina"
              value={editor.favoriteMarina}
              onChange={e => setEditor({ ...editor, favoriteMarina: e.target.value.slice(0, 80) })}
              placeholder="e.g. Sunset Marina"
              className="bg-background"
              data-testid="input-boat-fav-marina"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="boatFavCove">Favorite Cove <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="boatFavCove"
                value={editor.favoriteCove}
                onChange={e => setEditor({ ...editor, favoriteCove: e.target.value.slice(0, 80) })}
                placeholder="e.g. Wolf River"
                className="bg-background"
                data-testid="input-boat-fav-cove"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="boatFavActivity">Favorite Activity <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="boatFavActivity"
                value={editor.favoriteActivity}
                onChange={e => setEditor({ ...editor, favoriteActivity: e.target.value.slice(0, 80) })}
                placeholder="e.g. Sunset cruises"
                className="bg-background"
                data-testid="input-boat-fav-activity"
              />
            </div>
          </div>

          {/* Mods */}
          <div className="space-y-2">
            <Label htmlFor="boatMods">Mods / Upgrades <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="boatMods"
              value={editor.mods}
              onChange={e => setEditor({ ...editor, mods: e.target.value.slice(0, 500) })}
              placeholder="e.g. New tower speakers, underwater LEDs, upgraded prop"
              className="bg-background min-h-[60px]"
              data-testid="input-boat-mods"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="boatNotes">Story / Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="boatNotes"
              value={editor.notes}
              onChange={e => setEditor({ ...editor, notes: e.target.value.slice(0, 500) })}
              placeholder="What makes this one special?"
              className="bg-background min-h-[80px]"
              data-testid="input-boat-notes"
            />
          </div>

          {/* Color */}
          <div className="space-y-3">
            <Label>Color</Label>
            <div className="grid grid-cols-4 gap-3">
              {BOAT_COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setEditor({ ...editor, color: color.value })}
                  className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${editor.color === color.value ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                  style={{ backgroundColor: color.value, border: color.value === '#f8fafc' ? '1px solid #e2e8f0' : 'none' }}
                  title={color.label}
                />
              ))}
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer">
              <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border" style={{ backgroundColor: editor.color || "#0ea5e9" }}>
                <input
                  type="color"
                  value={editor.color || "#0ea5e9"}
                  onChange={e => setEditor({ ...editor, color: e.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Choose a custom boat color"
                />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Custom color</span>
                <span className="text-[11px] text-muted-foreground uppercase">{editor.color || "#0ea5e9"}</span>
              </div>
            </label>
          </div>

          {/* Accessories */}
          <div className="space-y-3">
            <Label>Accessories</Label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Neon underglow</span>
                <span className="text-[11px] text-muted-foreground">A glowing halo under your hull</span>
              </div>
              <Switch checked={editor.neon} onCheckedChange={(v) => setEditor({ ...editor, neon: v })} className="data-[state=checked]:bg-primary" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Pennant flag</span>
                <span className="text-[11px] text-muted-foreground">Fly a flag off the stern</span>
              </div>
              <Switch checked={editor.flag} onCheckedChange={(v) => setEditor({ ...editor, flag: v })} className="data-[state=checked]:bg-primary" />
            </label>

            {(editor.neon || editor.flag) && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-col">
                  <Label>Accent color</Label>
                  <span className="text-[11px] text-muted-foreground">Used for the flag &amp; underglow</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {BOAT_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditor({ ...editor, accent: color.value })}
                      className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${(editor.accent || editor.color) === color.value ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                      style={{ backgroundColor: color.value, border: color.value === '#f8fafc' ? '1px solid #e2e8f0' : 'none' }}
                      title={color.label}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer">
                  <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border" style={{ backgroundColor: editor.accent || editor.color || "#0ea5e9" }}>
                    <input
                      type="color"
                      value={editor.accent || editor.color || "#0ea5e9"}
                      onChange={e => setEditor({ ...editor, accent: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="Choose a custom accent color"
                    />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Custom accent</span>
                    <span className="text-[11px] text-muted-foreground uppercase">{editor.accent || editor.color || "#0ea5e9"}</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
      </SettingsShell>
    );
  }

  // ---------- Fleet list view ----------
  const addAction = (
    <Button size="sm" onClick={() => setEditor(editorFromBoat(null))} data-testid="button-add-boat">
      <Plus className="w-4 h-4 mr-2" /> Add
    </Button>
  );

  return (
    <SettingsShell title="My Fleet" action={addAction}>
      {/* Show fleet toggle */}
      <div className="rounded-2xl bg-card border border-border p-4 mb-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Display my fleet on my profile</span>
            <span className="text-[11px] text-muted-foreground">Turn this off if you'd rather keep your boats private — you can still check in, post, and earn badges.</span>
          </div>
          <Switch checked={showBoat} onCheckedChange={saveShowBoat} className="data-[state=checked]:bg-primary" data-testid="switch-show-boat" />
        </label>
      </div>

      {/* Fleet list */}
      {fleet.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-6 mb-4 flex flex-col items-center text-center gap-2">
          <Anchor className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-semibold">No boats yet — and that's just fine</p>
          <p className="text-xs text-muted-foreground max-w-[260px]">You can enjoy everything in the app without one. If you get a boat, kayak, or jet ski someday, add it here.</p>
          <Button size="sm" className="mt-1" onClick={() => setEditor(editorFromBoat(null))} data-testid="button-add-first-boat">
            <Plus className="w-4 h-4 mr-2" /> Add your first boat
          </Button>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {fleet.map((b) => {
            const photo = resolveAvatarUrl(b.photoUrl);
            return (
              <div key={b.id} className="rounded-2xl bg-card border border-border overflow-hidden" data-testid={`card-fleet-boat-${b.id}`}>
                {photo && (
                  <div className="relative aspect-[3/1] bg-muted">
                    <img src={photo} alt={b.name} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-3.5 flex items-center gap-3">
                  <BoatPreview type={b.boatType} color={b.color} neon={b.neon} flag={b.flag} accent={b.accent} scale={0.8} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold truncate">{b.name}</span>
                      {b.isPrimary && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5">
                          <Star className="w-2.5 h-2.5 fill-current" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[boatLabelFor(b.boatType), [b.year, b.brand, b.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!b.isPrimary && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetPrimary(b)} disabled={setPrimaryBoat.isPending} title="Make primary" data-testid={`button-set-primary-${b.id}`}>
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditor(editorFromBoat(b))} data-testid={`button-edit-boat-${b.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(b)} data-testid={`button-delete-boat-${b.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground px-1">Your Primary Boat is what friends see on your profile and on the map. When you check in, you can pick which one you're taking out.</p>
        </div>
      )}

      {/* Home marina (account-level) */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
        <Label htmlFor="homeMarina">Home Marina <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="flex gap-2">
          <Input
            id="homeMarina"
            value={homeMarina}
            onChange={e => setHomeMarina(e.target.value)}
            maxLength={80}
            placeholder="e.g. Sunset Marina"
            className="bg-background"
            data-testid="input-home-marina"
          />
          <Button size="sm" variant="secondary" onClick={saveHomeMarina} disabled={updateMe.isPending} data-testid="button-save-marina">
            <Save className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Shown on your profile — where your fleet calls home.</p>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes it out of your fleet. Photos already in your gallery stay put.
              {deleteTarget?.isPrimary && fleet.length > 1 ? " Your next boat will become the Primary Boat." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-boat">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsShell>
  );
}
