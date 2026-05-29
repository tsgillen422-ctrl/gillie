import React, { useEffect, useRef } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, LogOut, Map, Ship, Camera, ImagePlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { boatSvgFor, FLAG_SVG } from "../boats";

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

const BOAT_TYPES = [
  { value: 'speedboat', label: 'Speed Boat', desc: 'Sleek & fast' },
  { value: 'pontoon', label: 'Pontoon', desc: 'Relaxed cruiser' },
  { value: 'sailboat', label: 'Sailboat', desc: 'Wind powered' },
  { value: 'kayak', label: 'Kayak', desc: 'Paddle solo' },
  { value: 'jetski', label: 'Jet Ski', desc: 'Quick & nimble' },
  { value: 'yacht', label: 'Yacht', desc: 'Luxury cruiser' },
];

function BoatPreview({ type, color, neon, flag, accent }: { type: string; color: string; neon?: boolean; flag?: boolean; accent?: string }) {
  const accentColor = accent || color;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: 84, height: 56, color }}>
      {neon && (
        <span
          className="absolute rounded-full"
          style={{
            width: 56,
            height: 14,
            bottom: 8,
            background: accentColor,
            filter: "blur(7px)",
            opacity: 0.8,
          }}
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

export function SettingsPage() {
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  
  // Form state
  const [displayName, setDisplayName] = React.useState("");
  const [boatName, setBoatName] = React.useState("");
  const [boatColor, setBoatColor] = React.useState("");
  const [boatType, setBoatType] = React.useState("speedboat");
  const [boatNeon, setBoatNeon] = React.useState(false);
  const [boatFlag, setBoatFlag] = React.useState(false);
  const [boatAccent, setBoatAccent] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [shareLocation, setShareLocation] = React.useState(true);
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined);
  const [coverUrl, setCoverUrl] = React.useState<string | undefined>(undefined);

  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const avatarUpload = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" }),
  });
  const coverUpload = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" }),
  });

  // Init form
  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setBoatName(me.boatName || "");
      setBoatColor(me.boatColor || "#0ea5e9");
      setBoatType(me.boatType || "speedboat");
      setBoatNeon(me.boatNeon ?? false);
      setBoatFlag(me.boatFlag ?? false);
      setBoatAccent(me.boatAccent || "");
      setBio(me.bio || "");
      setShareLocation(me.shareLocation ?? true);
      setAvatarUrl(me.avatarUrl ?? undefined);
      setCoverUrl(me.coverUrl ?? undefined);
    }
  }, [me]);

  const handleImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "avatar" | "cover"
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    const uploader = kind === "avatar" ? avatarUpload : coverUpload;
    const res = await uploader.uploadFile(file);
    if (!res?.objectPath) return;
    if (kind === "avatar") setAvatarUrl(res.objectPath);
    else setCoverUrl(res.objectPath);
    updateMe.mutate({ data: kind === "avatar" ? { avatarUrl: res.objectPath } : { coverUrl: res.objectPath } }, {
      onSuccess: () => toast({ title: kind === "avatar" ? "Photo updated" : "Cover updated" }),
    });
  };

  const handleSave = () => {
    updateMe.mutate({
      data: {
        displayName,
        boatName,
        boatColor,
        boatType,
        boatNeon,
        boatFlag,
        boatAccent: boatAccent || null,
        bio,
        shareLocation
      }
    }, {
      onSuccess: () => {
        toast({ title: "Settings updated", description: "Your profile has been saved." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
      }
    });
  };

  // Immediate toggle for location
  const handleToggleLocation = (checked: boolean) => {
    setShareLocation(checked);
    updateMe.mutate({ data: { shareLocation: checked } }, {
      onSuccess: () => {
        toast({ 
          title: checked ? "Location Sharing On" : "Ghost Mode Activated", 
          description: checked ? "Friends can see you on the lake." : "Your boat is hidden from the map." 
        });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-y-auto">
      <div className="p-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <Button size="sm" onClick={handleSave} disabled={updateMe.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto w-full pb-20">
        
        {/* Main Setting: Location */}
        <Card className="border-border shadow-md border-primary/20 overflow-hidden relative">
          <div className={`absolute inset-0 opacity-10 pointer-events-none transition-colors duration-500 ${shareLocation ? 'bg-primary' : 'bg-muted'}`} />
          <CardHeader className="pb-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${shareLocation ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Location Sharing</CardTitle>
                  <CardDescription>Show my boat on the lake map</CardDescription>
                </div>
              </div>
              <Switch checked={shareLocation} onCheckedChange={handleToggleLocation} className="data-[state=checked]:bg-primary" />
            </div>
          </CardHeader>
        </Card>

        {/* Profile Settings */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Captain Profile</CardTitle>
            <CardDescription>How others see you on the water.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e, "avatar")} />
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e, "cover")} />

            {/* Cover photo */}
            <div className="space-y-2">
              <Label>Cover Photo</Label>
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                disabled={coverUpload.isUploading}
                className="relative w-full h-28 rounded-lg overflow-hidden border border-border bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center group"
              >
                {coverUrl && <img src={`/api/storage${coverUrl}`} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="relative flex items-center gap-2 text-xs font-medium bg-background/80 px-3 py-1.5 rounded-full shadow-sm">
                  {coverUpload.isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  {coverUrl ? "Change Cover" : "Add Cover"}
                </div>
              </button>
            </div>

            <div className="flex justify-center mb-6 -mt-12 relative z-10">
              <div className="relative">
                <UserAvatar name={me?.displayName || "User"} username={me?.username || ""} avatarUrl={avatarUrl} className="w-24 h-24 ring-4 ring-card" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => avatarRef.current?.click()}
                  disabled={avatarUpload.isUploading}
                  className="absolute -bottom-1 -right-1 rounded-full shadow-md h-8 w-8"
                >
                  {avatarUpload.isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-background" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="What's your lake story?" className="bg-background resize-none" rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Boat Settings */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ship className="w-5 h-5 text-primary" /> Vessel Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <div className="grid grid-cols-3 gap-2.5">
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
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full mt-8" variant="outline">
          <LogOut className="w-4 h-4 mr-2" /> Log Out
        </Button>
      </div>
    </div>
  );
}
