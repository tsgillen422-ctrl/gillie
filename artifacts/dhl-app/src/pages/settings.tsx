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

function BoatPreview({ type, color }: { type: string; color: string }) {
  const common = { width: 84, height: 48, viewBox: "0 0 56 32", fill: "none", xmlns: "http://www.w3.org/2000/svg" } as const;
  switch (type) {
    case 'pontoon':
      return (
        <svg {...common}>
          <rect x="7" y="22.5" width="42" height="5.5" rx="2.75" fill={color} stroke="#ffffff" strokeWidth="2" />
          <rect x="5" y="16" width="46" height="6" rx="2" fill={color} stroke="#ffffff" strokeWidth="2" />
          <rect x="12" y="4.5" width="32" height="4" rx="2" fill="#ffffff" opacity="0.92" />
          <rect x="13" y="8" width="2.2" height="8" rx="1" fill="#ffffff" opacity="0.7" />
          <rect x="40.8" y="8" width="2.2" height="8" rx="1" fill="#ffffff" opacity="0.7" />
        </svg>
      );
    case 'sailboat':
      return (
        <svg {...common}>
          <path d="M8 22 H48 L43 28 C42 29.5 40 30 38 30 H18 C16 30 14 29.5 13 28 Z" fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <rect x="27" y="3" width="2" height="19" fill="#ffffff" opacity="0.85" />
          <path d="M30 4 L30 20 L42 20 Z" fill="#ffffff" opacity="0.92" />
          <path d="M26 7 L26 20 L17 20 Z" fill="#ffffff" opacity="0.7" />
        </svg>
      );
    case 'kayak':
      return (
        <svg {...common}>
          <path d="M4 19 C12 15 44 15 52 19 C44 23 12 23 4 19 Z" fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <ellipse cx="28" cy="19" rx="4.5" ry="2" fill="#ffffff" opacity="0.6" />
          <rect x="18" y="10" width="20" height="2.4" rx="1.2" fill="#ffffff" opacity="0.8" />
        </svg>
      );
    case 'jetski':
      return (
        <svg {...common}>
          <path d="M6 20 C10 16 20 15 30 15 C42 15 50 17 52 20 C50 24 44 26 34 26 H16 C11 26 7 23 6 20 Z" fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <path d="M22 15 C24 12 30 12 33 14 L33 16 H22 Z" fill="#ffffff" opacity="0.85" />
          <rect x="13" y="11" width="9" height="2" rx="1" fill="#ffffff" opacity="0.8" />
          <rect x="20" y="12" width="2" height="4" rx="1" fill="#ffffff" opacity="0.7" />
        </svg>
      );
    case 'yacht':
      return (
        <svg {...common}>
          <path d="M4 19 H50 L45 27 C44 29 42 29.5 39 29.5 H15 C12 29.5 10 29 9 27 Z" fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <rect x="12" y="12" width="30" height="7" rx="1.5" fill="#ffffff" opacity="0.92" />
          <rect x="18" y="6" width="16" height="6" rx="1.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
          <rect x="15" y="14" width="3" height="3" rx="0.6" fill={color} opacity="0.6" />
          <rect x="21" y="14" width="3" height="3" rx="0.6" fill={color} opacity="0.6" />
          <rect x="27" y="14" width="3" height="3" rx="0.6" fill={color} opacity="0.6" />
          <rect x="33" y="14" width="3" height="3" rx="0.6" fill={color} opacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg {...common} viewBox="0 0 56 30">
          <path d="M3 13 H44 C50 13 53 15 53.5 17 L48 25 C47 27 45 28 42 28 H14 C11 28 9 27 8 25 Z" fill={color} stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M29 6.5 C30.5 6.5 31.5 7 32.5 8 L39 13 H27 V9 C27 7.5 27.5 6.5 29 6.5 Z" fill="#ffffff" opacity="0.92" />
          <rect x="10" y="14.5" width="33" height="3" rx="1.5" fill="#ffffff" opacity="0.55" />
        </svg>
      );
  }
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
                <BoatPreview type={boatType} color={boatColor || "#0ea5e9"} />
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
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full mt-8" variant="outline">
          <LogOut className="w-4 h-4 mr-2" /> Log Out
        </Button>
      </div>
    </div>
  );
}
