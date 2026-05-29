import React, { useEffect } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, LogOut, Map, Ship } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BOAT_COLORS = [
  { value: '#0ea5e9', label: 'Sky Blue' },
  { value: '#0284c7', label: 'Deep Lake' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Sun Gold' },
  { value: '#ef4444', label: 'Red Wake' },
  { value: '#8b5cf6', label: 'Dusk Purple' },
  { value: '#334155', label: 'Slate' },
  { value: '#f8fafc', label: 'White' }
];

export function SettingsPage() {
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  
  // Form state
  const [displayName, setDisplayName] = React.useState("");
  const [boatName, setBoatName] = React.useState("");
  const [boatColor, setBoatColor] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [shareLocation, setShareLocation] = React.useState(true);

  // Init form
  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setBoatName(me.boatName || "");
      setBoatColor(me.boatColor || "#0ea5e9");
      setBio(me.bio || "");
      setShareLocation(me.shareLocation ?? true);
    }
  }, [me]);

  const handleSave = () => {
    updateMe.mutate({
      data: {
        displayName,
        boatName,
        boatColor,
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
            <div className="flex justify-center mb-6">
              <div className="relative">
                <UserAvatar name={me?.displayName || "User"} username={me?.username || ""} avatarUrl={me?.avatarUrl} className="w-24 h-24" />
                <Button size="sm" variant="secondary" className="absolute -bottom-2 -right-2 rounded-full shadow-md text-xs h-8">Change</Button>
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
            <div className="space-y-2">
              <Label htmlFor="boatName">Boat Name</Label>
              <Input id="boatName" value={boatName} onChange={e => setBoatName(e.target.value)} placeholder="e.g. Wake Maker" className="bg-background" />
            </div>
            
            <div className="space-y-3">
              <Label>Map Icon Color</Label>
              <div className="grid grid-cols-4 gap-3">
                {BOAT_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setBoatColor(color.value)}
                    className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${boatColor === color.value ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                    style={{ backgroundColor: color.value, border: color.value === '#f8fafc' ? '1px solid #e2e8f0' : 'none' }}
                    title={color.label}
                  />
                ))}
              </div>
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
