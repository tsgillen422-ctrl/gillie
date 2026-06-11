import React, { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMe, useUpdateMe, useGetBlockedUsers, useUnblockUser, useGetMutedUsers, useUnmuteUser, getGetBlockedUsersQueryKey, getGetMutedUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { UserAvatar } from "@/components/UserAvatar";
import { SosButton } from "@/components/SosButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, LogOut, Map, Ship, Camera, ImagePlus, Loader2, Lock, Globe, Ban, ShieldOff, Users, EyeOff, Moon, Sun, Monitor, VolumeX, Volume2, ShieldCheck, Bookmark, ChevronRight, Heart, ScrollText, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WaiverBody } from "@/lib/waiver";
import { INTEREST_DEFS } from "@/lib/interests";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { getCroppedImageFile, type CropArea } from "@/lib/cropImage";
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
  { value: 'fishing', label: 'Fishing Boat', desc: 'Reel them in' },
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
  const [interests, setInterests] = React.useState<string[]>([]);
  const [location, setLocation] = React.useState("");
  const [hometown, setHometown] = React.useState("");
  const [birthday, setBirthday] = React.useState("");
  const [relationshipStatus, setRelationshipStatus] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [work, setWork] = React.useState("");
  const [shareLocation, setShareLocation] = React.useState(true);
  const [requireFollowApproval, setRequireFollowApproval] = React.useState(false);
  const [showFollowers, setShowFollowers] = React.useState(true);
  const [showFriends, setShowFriends] = React.useState(true);
  const [followerSeeLocation, setFollowerSeeLocation] = React.useState(true);
  const [followerSeePosts, setFollowerSeePosts] = React.useState(true);
  const [followerSendMessages, setFollowerSendMessages] = React.useState(true);
  const [showMatureContent, setShowMatureContent] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined);
  const [coverUrl, setCoverUrl] = React.useState<string | undefined>(undefined);
  const [cropState, setCropState] = React.useState<{ kind: "avatar" | "cover"; fileName: string; src: string } | null>(null);
  const [cropping, setCropping] = React.useState(false);
  const [showWaiver, setShowWaiver] = React.useState(false);

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
      setInterests(((me as any).interests as string[]) || []);
      setLocation((me as any).location || "");
      setHometown((me as any).hometown || "");
      setBirthday((me as any).birthday || "");
      setRelationshipStatus((me as any).relationshipStatus || "");
      setGender((me as any).gender || "");
      setWork((me as any).work || "");
      setShareLocation(me.shareLocation ?? true);
      setRequireFollowApproval((me as any).requireFollowApproval ?? false);
      setShowFollowers((me as any).showFollowers ?? true);
      setShowFriends((me as any).showFriends ?? true);
      setFollowerSeeLocation((me as any).followerSeeLocation ?? true);
      setFollowerSeePosts((me as any).followerSeePosts ?? true);
      setFollowerSendMessages((me as any).followerSendMessages ?? true);
      setShowMatureContent((me as any).showMatureContent ?? false);
      setAvatarUrl(me.avatarUrl ?? undefined);
      setCoverUrl(me.coverUrl ?? undefined);
    }
  }, [me]);

  // Revoke any leftover object URL when leaving the page.
  const cropSrcRef = useRef<string | null>(null);
  cropSrcRef.current = cropState?.src ?? null;
  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);

  const handleImage = (
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
        boatName,
        boatColor,
        boatType,
        boatNeon,
        boatFlag,
        boatAccent: boatAccent || null,
        bio,
        interests,
        location: location || null,
        hometown: hometown || null,
        birthday: birthday || null,
        relationshipStatus: relationshipStatus || null,
        gender: gender || null,
        work: work || null,
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

  const handleToggleApproval = (checked: boolean) => {
    setRequireFollowApproval(checked);
    updateMe.mutate({ data: { requireFollowApproval: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Follow Approval On" : "Follow Approval Off",
          description: checked
            ? "New followers will need your approval first."
            : "Anyone can follow you instantly.",
        });
      },
      onError: () => {
        setRequireFollowApproval(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const handleToggleShowFollowers = (checked: boolean) => {
    setShowFollowers(checked);
    updateMe.mutate({ data: { showFollowers: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Followers Visible" : "Followers Hidden",
          description: checked
            ? "Others can see your followers and following."
            : "Only you can see your followers and following.",
        });
      },
      onError: () => {
        setShowFollowers(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const handleToggleShowFriends = (checked: boolean) => {
    setShowFriends(checked);
    updateMe.mutate({ data: { showFriends: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Friends List Visible" : "Friends List Hidden",
          description: checked
            ? "Others can see your friends list on your profile."
            : "Only you can see your friends list.",
        });
      },
      onError: () => {
        setShowFriends(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const handleToggleFollowerSeeLocation = (checked: boolean) => {
    setFollowerSeeLocation(checked);
    updateMe.mutate({ data: { followerSeeLocation: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Location Shared with Followers" : "Location Hidden from Followers",
          description: checked
            ? "Followers you don't follow back can see you on the map."
            : "Only people you follow back can see you on the map.",
        });
      },
      onError: () => {
        setFollowerSeeLocation(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const handleToggleFollowerSeePosts = (checked: boolean) => {
    setFollowerSeePosts(checked);
    updateMe.mutate({ data: { followerSeePosts: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Posts Shared with Followers" : "Posts Hidden from Followers",
          description: checked
            ? "Followers you don't follow back can see your friends-only posts."
            : "Only people you follow back can see your friends-only posts.",
        });
      },
      onError: () => {
        setFollowerSeePosts(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const handleToggleFollowerSendMessages = (checked: boolean) => {
    setFollowerSendMessages(checked);
    updateMe.mutate({ data: { followerSendMessages: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Followers Can Message You" : "Follower Messages Off",
          description: checked
            ? "Followers you don't follow back can start a chat with you."
            : "Only people you follow back can message you.",
        });
      },
      onError: () => {
        setFollowerSendMessages(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
    });
  };

  const handleToggleMature = (checked: boolean) => {
    setShowMatureContent(checked);
    updateMe.mutate({ data: { showMatureContent: checked } }, {
      onSuccess: () => {
        toast({
          title: checked ? "Sensitive Content Shown" : "Sensitive Content Hidden",
          description: checked
            ? "Content flagged as mature will no longer be blurred."
            : "Content flagged as mature will be blurred until you tap to view.",
        });
      },
      onError: () => {
        setShowMatureContent(!checked);
        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
      },
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

        {/* Appearance */}
        <AppearanceCard />

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
                </div>
              </div>
              <Switch checked={shareLocation} onCheckedChange={handleToggleLocation} className="data-[state=checked]:bg-primary" />
            </div>
          </CardHeader>
        </Card>

        {/* Follow Approval */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${requireFollowApproval ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {requireFollowApproval ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                </div>
                <div>
                  <CardTitle className="text-lg">Approve New Followers</CardTitle>
                  <CardDescription>Require approval before someone can follow you</CardDescription>
                </div>
              </div>
              <Switch checked={requireFollowApproval} onCheckedChange={handleToggleApproval} className="data-[state=checked]:bg-primary" />
            </div>
          </CardHeader>
        </Card>

        {/* Followers Visibility */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${showFollowers ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {showFollowers ? <Users className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <CardTitle className="text-lg">Show Followers & Following</CardTitle>
                  <CardDescription>Let others see who follows you and who you follow</CardDescription>
                </div>
              </div>
              <Switch checked={showFollowers} onCheckedChange={handleToggleShowFollowers} className="data-[state=checked]:bg-primary" />
            </div>
          </CardHeader>
        </Card>

        {/* Friends List Visibility */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${showFriends ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {showFriends ? <Users className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <CardTitle className="text-lg">Show Friends List</CardTitle>
                  <CardDescription>Let others see your friends on your profile</CardDescription>
                </div>
              </div>
              <Switch checked={showFriends} onCheckedChange={handleToggleShowFriends} className="data-[state=checked]:bg-primary" />
            </div>
          </CardHeader>
        </Card>

        {/* What followers you don't follow back can see */}
        <div className="pt-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Followers you don't follow back
          </h2>
          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${followerSeeLocation ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Map className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">See My Location</CardTitle>
                      <CardDescription>Show your boat on the map to followers you don't follow back</CardDescription>
                    </div>
                  </div>
                  <Switch checked={followerSeeLocation} onCheckedChange={handleToggleFollowerSeeLocation} className="data-[state=checked]:bg-primary" />
                </div>
              </CardHeader>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${followerSeePosts ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <ScrollText className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">See My Posts</CardTitle>
                      <CardDescription>Let them see your friends-only posts</CardDescription>
                    </div>
                  </div>
                  <Switch checked={followerSeePosts} onCheckedChange={handleToggleFollowerSeePosts} className="data-[state=checked]:bg-primary" />
                </div>
              </CardHeader>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${followerSendMessages ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Message Me</CardTitle>
                      <CardDescription>Let them start a direct message with you</CardDescription>
                    </div>
                  </div>
                  <Switch checked={followerSendMessages} onCheckedChange={handleToggleFollowerSendMessages} className="data-[state=checked]:bg-primary" />
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Sensitive / Mature Content */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${showMatureContent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {showMatureContent ? <ShieldCheck className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <CardTitle className="text-lg">Show Sensitive Content</CardTitle>
                  <CardDescription>Reveal posts, photos, and messages flagged as mature instead of blurring them</CardDescription>
                </div>
              </div>
              <Switch checked={showMatureContent} onCheckedChange={handleToggleMature} className="data-[state=checked]:bg-primary" />
            </div>
          </CardHeader>
        </Card>

        <BlockedUsersCard />

        <MutedUsersCard />

        {/* Rules & Waiver */}
        <Card className="border-border shadow-sm hover-elevate cursor-pointer" onClick={() => setShowWaiver(true)}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <ScrollText className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Rules & Waiver</CardTitle>
                  <CardDescription>Review the safety rules and liability waiver</CardDescription>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        <Dialog open={showWaiver} onOpenChange={setShowWaiver}>
          <DialogContent className="max-w-lg p-0 gap-0 max-h-[85vh] flex flex-col">
            <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
              <DialogTitle>Welcome to Gillie! 🎣</DialogTitle>
              <DialogDescription>Safety rules &amp; liability waiver</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
              <div className="p-5">
                <WaiverBody />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {me?.isAdmin && (
          <Link href="/admin">
            <Card className="border-border shadow-sm hover-elevate cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Moderation Dashboard</CardTitle>
                      <CardDescription>Review reported content and take action</CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Profile Settings */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Captain Profile</CardTitle>
            <CardDescription>How others see you on the water.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

        <div className="flex items-center gap-3 mt-8">
          <LogoutButton />
          <SosButton />
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <Button
      variant="outline"
      className="flex-1 text-destructive hover:text-destructive"
      onClick={() => signOut({ redirectUrl: basePath || "/" })}
    >
      <LogOut className="w-4 h-4 mr-2" /> Log Out
    </Button>
  );
}

function AppearanceCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const current = mounted ? (theme ?? "system") : "system";

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isDark ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <CardTitle className="text-lg">Dark Mode</CardTitle>
              <CardDescription>
                {current === "system" ? "Following your device setting" : "Switch between light and dark themes"}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            className="data-[state=checked]:bg-primary"
            aria-label="Toggle dark mode"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2.5">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}
                aria-pressed={active}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function BlockedUsersCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: blocked, isLoading } = useGetBlockedUsers();
  const unblockUser = useUnblockUser();

  const handleUnblock = (userId: number) => {
    unblockUser.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "User unblocked", description: "They can interact with you again." });
        queryClient.invalidateQueries({ queryKey: getGetBlockedUsersQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Couldn't unblock this user.", variant: "destructive" });
      },
    });
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted text-muted-foreground">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Blocked Users</CardTitle>
            <CardDescription>People you've blocked from following you</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading...</p>
        ) : !blocked || blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">You haven't blocked anyone.</p>
        ) : (
          <div className="space-y-2">
            {blocked.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <Link href={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl ?? undefined} className="w-9 h-9" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnblock(u.id)}
                  disabled={unblockUser.isPending}
                >
                  <ShieldOff className="w-4 h-4 mr-2" /> Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MutedUsersCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: muted, isLoading } = useGetMutedUsers();
  const unmuteUser = useUnmuteUser();

  const handleUnmute = (userId: number) => {
    unmuteUser.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "User unmuted", description: "Their posts will show in your feed again." });
        queryClient.invalidateQueries({ queryKey: getGetMutedUsersQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Couldn't unmute this user.", variant: "destructive" });
      },
    });
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted text-muted-foreground">
            <VolumeX className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Muted Users</CardTitle>
            <CardDescription>People whose posts are hidden from your feed</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading...</p>
        ) : !muted || muted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">You haven't muted anyone.</p>
        ) : (
          <div className="space-y-2">
            {muted.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <Link href={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl ?? undefined} className="w-9 h-9" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnmute(u.id)}
                  disabled={unmuteUser.isPending}
                >
                  <Volume2 className="w-4 h-4 mr-2" /> Unmute
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
