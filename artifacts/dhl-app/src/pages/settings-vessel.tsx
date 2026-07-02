import React, { useEffect, useRef } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, Camera, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { getCroppedImageFile, type CropArea } from "@/lib/cropImage";
import { resolveAvatarUrl } from "@/components/UserAvatar";
import { boatSvgFor, FLAG_SVG, BOAT_TYPES, BOAT_BRANDS, BOAT_BRAND_MAX_LENGTH } from "../boats";
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

function BoatPreview({ type, color, neon, flag, accent }: { type: string; color: string; neon?: boolean; flag?: boolean; accent?: string }) {
  const accentColor = accent || color;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: 84, height: 56, color }}>
      {neon && (
        <span
          className="absolute rounded-full"
          style={{ width: 56, height: 14, bottom: 8, background: accentColor, filter: "blur(7px)", opacity: 0.8 }}
        />
      )}
      <span
        className="relative"
        style={{ color, lineHeight: 0, filter: "drop-shadow(0 4px 4px rgba(11,58,91,0.28))" }}
        dangerouslySetInnerHTML={{ __html: boatSvgFor(type) }}
      />
      {flag && (
        <span
          className="absolute"
          style={{ color: accentColor, left: 8, top: 0, lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: FLAG_SVG }}
        />
      )}
    </span>
  );
}

export function VesselDetailsPage() {
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();

  const [boatName, setBoatName] = React.useState("");
  const [boatColor, setBoatColor] = React.useState("");
  const [boatType, setBoatType] = React.useState("speedboat");
  const [boatBrand, setBoatBrand] = React.useState("");
  const [boatModel, setBoatModel] = React.useState("");
  const [boatYear, setBoatYear] = React.useState("");
  const [homeMarina, setHomeMarina] = React.useState("");
  const [boatPhotoUrl, setBoatPhotoUrl] = React.useState<string | null>(null);
  const [showBoat, setShowBoat] = React.useState(true);
  const [boatNeon, setBoatNeon] = React.useState(false);
  const [boatFlag, setBoatFlag] = React.useState(false);
  const [boatAccent, setBoatAccent] = React.useState("");
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [cropFileName, setCropFileName] = React.useState("boat.jpg");
  const [cropping, setCropping] = React.useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const photoUpload = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" }),
  });

  useEffect(() => {
    if (me) {
      setBoatName(me.boatName || "");
      setBoatColor(me.boatColor || "#0ea5e9");
      setBoatType(me.boatType || "speedboat");
      setBoatBrand(me.boatBrand || "");
      setBoatModel((me as any).boatModel || "");
      setBoatYear((me as any).boatYear ? String((me as any).boatYear) : "");
      setHomeMarina((me as any).homeMarina || "");
      setBoatPhotoUrl((me as any).boatPhotoUrl || null);
      setShowBoat((me as any).showBoat ?? true);
      setBoatNeon(me.boatNeon ?? false);
      setBoatFlag(me.boatFlag ?? false);
      setBoatAccent(me.boatAccent || "");
    }
  }, [me]);

  const cropSrcRef = useRef<string | null>(null);
  cropSrcRef.current = cropSrc;
  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);

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
    if (!cropSrc) return;
    setCropping(true);
    try {
      const cropped = await getCroppedImageFile(cropSrc, area, cropFileName);
      const res = await photoUpload.uploadFile(await compressImage(cropped));
      if (!res?.objectPath) return;
      setBoatPhotoUrl(res.objectPath);
      updateMe.mutate({ data: { boatPhotoUrl: res.objectPath } as any }, {
        onSuccess: () => toast({ title: "Boat photo updated" }),
      });
      closeCrop();
    } catch {
      toast({ title: "Could not process image", description: "Please try a different photo.", variant: "destructive" });
    } finally {
      setCropping(false);
    }
  };

  const removePhoto = () => {
    setBoatPhotoUrl(null);
    updateMe.mutate({ data: { boatPhotoUrl: null } as any }, {
      onSuccess: () => toast({ title: "Boat photo removed" }),
    });
  };

  const handleSave = () => {
    const yearTrimmed = boatYear.trim();
    const yearNum = yearTrimmed ? Number(yearTrimmed) : null;
    if (yearTrimmed && (!Number.isInteger(yearNum) || yearNum! < 1900 || yearNum! > new Date().getFullYear() + 1)) {
      toast({ title: "Check the year", description: "Please enter a valid boat year (e.g. 2019).", variant: "destructive" });
      return;
    }
    updateMe.mutate({
      data: {
        boatName,
        boatColor,
        boatType,
        boatBrand: boatBrand.trim() || null,
        boatModel: boatModel.trim() || null,
        boatYear: yearNum,
        homeMarina: homeMarina.trim() || null,
        showBoat,
        boatNeon,
        boatFlag,
        boatAccent: boatAccent || null,
      } as any,
    }, {
      onSuccess: () => {
        toast({ title: "Settings updated", description: "Your profile has been saved." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
      },
    });
  };

  const saveAction = (
    <Button size="sm" onClick={handleSave} disabled={updateMe.isPending} data-testid="button-save-vessel">
      <Save className="w-4 h-4 mr-2" /> Save
    </Button>
  );

  if (isLoading) {
    return (
      <SettingsShell title="Vessel Details">
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      </SettingsShell>
    );
  }

  const resolvedPhoto = resolveAvatarUrl(boatPhotoUrl);

  return (
    <SettingsShell title="Vessel Details" action={saveAction}>
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

      {/* Show boat toggle */}
      <div className="rounded-2xl bg-card border border-border p-4 mb-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Display my boat on my profile</span>
            <span className="text-[11px] text-muted-foreground">Turn this off if you don't own a boat — you can still check in, post, and earn badges.</span>
          </div>
          <Switch checked={showBoat} onCheckedChange={setShowBoat} className="data-[state=checked]:bg-primary" data-testid="switch-show-boat" />
        </label>
      </div>

      <div className={`rounded-2xl bg-card border border-border p-4 space-y-5 ${showBoat ? "" : "opacity-50 pointer-events-none select-none"}`}>
        {/* Boat photo */}
        <div className="space-y-2">
          <Label>Boat Photo</Label>
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted aspect-video">
            {resolvedPhoto ? (
              <img src={resolvedPhoto} alt="Your boat" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <Camera className="w-6 h-6" />
                <span className="text-xs">Show off your real boat</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 flex gap-2">
              {boatPhotoUrl && (
                <Button type="button" size="sm" variant="secondary" onClick={removePhoto} data-testid="button-remove-boat-photo">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button type="button" size="sm" variant="secondary" onClick={() => photoRef.current?.click()} disabled={photoUpload.isUploading} data-testid="button-upload-boat-photo">
                {photoUpload.isUploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
                {boatPhotoUrl ? "Change photo" : "Add photo"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Your boat photo is the highlight of your profile's My Boat card.</p>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-border bg-gradient-to-b from-sky-100 to-sky-200 p-4 flex flex-col items-center gap-1">
          <div className="flex items-center justify-center h-14">
            <BoatPreview type={boatType} color={boatColor || "#0ea5e9"} neon={boatNeon} flag={boatFlag} accent={boatAccent || undefined} />
          </div>
          <span className="text-xs font-medium text-slate-600">{boatName || "Your boat on the lake"}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="boatName">Boat Name</Label>
          <Input id="boatName" value={boatName} onChange={e => setBoatName(e.target.value)} placeholder="e.g. Wake Maker" className="bg-background" />
        </div>

        {/* Boat type */}
        <div className="space-y-3">
          <Label>Boat Style</Label>
          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-2.5">
            {BOAT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setBoatType(t.value)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 transition-all ${boatType === t.value ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}
              >
                <BoatPreview type={t.value} color={boatColor || "#0ea5e9"} />
                <span className="text-xs font-semibold leading-tight">{t.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Boat brand (optional) */}
        <div className="space-y-2">
          <Label htmlFor="boatBrand">Brand / Manufacturer <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="boatBrand"
            list="boat-brand-suggestions"
            value={boatBrand}
            onChange={e => setBoatBrand(e.target.value)}
            maxLength={BOAT_BRAND_MAX_LENGTH}
            placeholder="e.g. MasterCraft, Ranger, Fountain"
            className="bg-background"
            data-testid="input-boat-brand"
          />
          <datalist id="boat-brand-suggestions">
            {BOAT_BRANDS.map(b => <option key={b} value={b} />)}
          </datalist>
          <p className="text-[11px] text-muted-foreground">Pick a suggestion or type your own — shown on your profile next to your boat style.</p>
        </div>

        {/* Model + Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="boatModel">Model <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="boatModel"
              value={boatModel}
              onChange={e => setBoatModel(e.target.value)}
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
              value={boatYear}
              onChange={e => setBoatYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="e.g. 2019"
              className="bg-background"
              data-testid="input-boat-year"
            />
          </div>
        </div>

        {/* Home marina */}
        <div className="space-y-2">
          <Label htmlFor="homeMarina">Home Marina <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="homeMarina"
            value={homeMarina}
            onChange={e => setHomeMarina(e.target.value)}
            maxLength={80}
            placeholder="e.g. Sunset Marina"
            className="bg-background"
            data-testid="input-home-marina"
          />
        </div>

        <div className="space-y-3">
          <Label>Boat Color</Label>
          <div className="grid grid-cols-4 gap-3">
            {BOAT_COLORS.map(color => (
              <button
                key={color.value}
                type="button"
                onClick={() => setBoatColor(color.value)}
                className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${boatColor === color.value ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                style={{ backgroundColor: color.value, border: color.value === '#f8fafc' ? '1px solid #e2e8f0' : 'none' }}
                title={color.label}
              />
            ))}
          </div>
          {/* Custom color */}
          <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer">
            <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border" style={{ backgroundColor: boatColor || "#0ea5e9" }}>
              <input
                type="color"
                value={boatColor || "#0ea5e9"}
                onChange={e => setBoatColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Choose a custom boat color"
              />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Custom color</span>
              <span className="text-[11px] text-muted-foreground uppercase">{boatColor || "#0ea5e9"}</span>
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
            <Switch checked={boatNeon} onCheckedChange={setBoatNeon} className="data-[state=checked]:bg-primary" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Pennant flag</span>
              <span className="text-[11px] text-muted-foreground">Fly a flag off the stern</span>
            </div>
            <Switch checked={boatFlag} onCheckedChange={setBoatFlag} className="data-[state=checked]:bg-primary" />
          </label>

          {(boatNeon || boatFlag) && (
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
                    onClick={() => setBoatAccent(color.value)}
                    className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${(boatAccent || boatColor) === color.value ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                    style={{ backgroundColor: color.value, border: color.value === '#f8fafc' ? '1px solid #e2e8f0' : 'none' }}
                    title={color.label}
                  />
                ))}
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer">
                <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border" style={{ backgroundColor: boatAccent || boatColor || "#0ea5e9" }}>
                  <input
                    type="color"
                    value={boatAccent || boatColor || "#0ea5e9"}
                    onChange={e => setBoatAccent(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Choose a custom accent color"
                  />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Custom accent</span>
                  <span className="text-[11px] text-muted-foreground uppercase">{boatAccent || boatColor || "#0ea5e9"}</span>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>
    </SettingsShell>
  );
}
