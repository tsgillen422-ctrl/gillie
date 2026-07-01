import React, { useEffect, useRef } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { UserAvatar } from "@/components/UserAvatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Camera, ImagePlus, Loader2, Heart } from "lucide-react";
import { INTEREST_DEFS } from "@/lib/interests";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { getCroppedImageFile, type CropArea } from "@/lib/cropImage";
import { SettingsShell } from "@/components/settings-ui";

export function CaptainProfilePage() {
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();

  const [displayName, setDisplayName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [interests, setInterests] = React.useState<string[]>([]);
  const [location, setLocation] = React.useState("");
  const [hometown, setHometown] = React.useState("");
  const [birthday, setBirthday] = React.useState("");
  const [relationshipStatus, setRelationshipStatus] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [work, setWork] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined);
  const [coverUrl, setCoverUrl] = React.useState<string | undefined>(undefined);
  const [cropState, setCropState] = React.useState<{ kind: "avatar" | "cover"; fileName: string; src: string } | null>(null);
  const [cropping, setCropping] = React.useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const avatarUpload = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" }),
  });
  const coverUpload = useUpload({
    onError: () => toast({ title: "Upload failed", description: "Could not upload that photo.", variant: "destructive" }),
  });

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setBio(me.bio || "");
      setInterests(((me as any).interests as string[]) || []);
      setLocation((me as any).location || "");
      setHometown((me as any).hometown || "");
      setBirthday((me as any).birthday || "");
      setRelationshipStatus((me as any).relationshipStatus || "");
      setGender((me as any).gender || "");
      setWork((me as any).work || "");
      setAvatarUrl(me.avatarUrl ?? undefined);
      setCoverUrl(me.coverUrl ?? undefined);
    }
  }, [me]);

  const cropSrcRef = useRef<string | null>(null);
  cropSrcRef.current = cropState?.src ?? null;
  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>, kind: "avatar" | "cover") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    setCropState((prev) => {
      if (prev) URL.revokeObjectURL(prev.src);
      return { kind, fileName: file.name, src: URL.createObjectURL(file) };
    });
  };

  const closeCrop = () => {
    setCropState((prev) => {
      if (prev) URL.revokeObjectURL(prev.src);
      return null;
    });
  };

  const handleCropConfirm = async (area: CropArea) => {
    if (!cropState) return;
    const { kind, src, fileName } = cropState;
    setCropping(true);
    try {
      const cropped = await getCroppedImageFile(src, area, fileName);
      const uploader = kind === "avatar" ? avatarUpload : coverUpload;
      const res = await uploader.uploadFile(await compressImage(cropped));
      if (!res?.objectPath) return;
      if (kind === "avatar") setAvatarUrl(res.objectPath);
      else setCoverUrl(res.objectPath);
      updateMe.mutate({ data: kind === "avatar" ? { avatarUrl: res.objectPath } : { coverUrl: res.objectPath } }, {
        onSuccess: () => toast({ title: kind === "avatar" ? "Photo updated" : "Cover updated" }),
      });
      closeCrop();
    } catch {
      toast({ title: "Could not process image", description: "Please try a different photo.", variant: "destructive" });
    } finally {
      setCropping(false);
    }
  };

  const handleSave = () => {
    updateMe.mutate({
      data: {
        displayName,
        bio,
        interests,
        location: location || null,
        hometown: hometown || null,
        birthday: birthday || null,
        relationshipStatus: relationshipStatus || null,
        gender: gender || null,
        work: work || null,
      },
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
    <Button size="sm" onClick={handleSave} disabled={updateMe.isPending} data-testid="button-save-profile">
      <Save className="w-4 h-4 mr-2" /> Save
    </Button>
  );

  if (isLoading) {
    return (
      <SettingsShell title="Captain Profile">
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Captain Profile" action={saveAction}>
      <p className="text-sm text-muted-foreground mb-5 px-1">How others see you on the water.</p>

      <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e, "avatar")} />
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e, "cover")} />

        <ImageCropDialog
          open={!!cropState}
          imageSrc={cropState?.src ?? null}
          aspect={cropState?.kind === "cover" ? 3 : 1}
          cropShape={cropState?.kind === "cover" ? "rect" : "round"}
          title={cropState?.kind === "cover" ? "Adjust cover photo" : "Adjust profile photo"}
          busy={cropping}
          onCancel={closeCrop}
          onConfirm={handleCropConfirm}
        />

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

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            <Label>Interests</Label>
          </div>
          <p className="text-xs text-muted-foreground">Pick what you love on the lake. These show on your profile.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {INTEREST_DEFS.map(({ key, label, Icon }) => {
              const on = interests.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setInterests(prev =>
                      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                    )
                  }
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors " +
                    (on
                      ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                      : "bg-muted/60 text-muted-foreground border-border hover:bg-muted")
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <p className="text-sm font-medium text-foreground">About You</p>
          <p className="text-xs text-muted-foreground">Optional details shown on your profile. Leave any blank to hide them.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Where you live now" className="bg-background" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hometown">Born In</Label>
          <Input id="hometown" value={hometown} onChange={e => setHometown(e.target.value)} placeholder="Where you were born" className="bg-background" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="work">Work</Label>
          <Input id="work" value={work} onChange={e => setWork(e.target.value)} placeholder="What you do for work" className="bg-background" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthday">Birthday</Label>
          <Input id="birthday" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="bg-background" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="relationshipStatus">Relationship Status</Label>
          <select
            id="relationshipStatus"
            value={relationshipStatus}
            onChange={e => setRelationshipStatus(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Prefer not to say</option>
            <option value="Single">Single</option>
            <option value="In a relationship">In a relationship</option>
            <option value="Engaged">Engaged</option>
            <option value="Married">Married</option>
            <option value="It's complicated">It's complicated</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            value={gender}
            onChange={e => setGender(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    </SettingsShell>
  );
}
