import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Users, MessageSquare, Anchor, ChevronRight, Map, Fish, Newspaper, LifeBuoy, Waves, Check } from "lucide-react";
import { useUpdateMe, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LAKES, DEFAULT_LAKE_ID } from "@workspace/lake-config";
import { useLake } from "@/lib/lake-context";

const ONBOARDING_KEY = "dhl-onboarding-complete-v1";

const SLIDES = [
  {
    icon: Anchor,
    emoji: "⚓",
    title: "Welcome to Gillie",
    body: "Your home base for everything happening on the water — friends, spots, and the day's conditions, all in one place.",
  },
  {
    icon: MapPin,
    emoji: "📍",
    title: "Drop pins, find spots",
    body: "Mark fishing holes, hazards, marinas and more. Search the map, save your favorites, and get directions in a tap.",
  },
  {
    icon: Users,
    emoji: "🛥️",
    title: "See who's on the lake",
    body: "Share your location to let approved friends see you on the map, and see who else is out. Sharing is off until you turn it on — never automatic — and you can Go Ghost anytime.",
  },
  {
    icon: Newspaper,
    emoji: "🎣",
    title: "Share the catch",
    body: "Post photos, log your catches, and see what the community is up to. The feed keeps you in the loop on events and the day's bite.",
  },
  {
    icon: MessageSquare,
    emoji: "💬",
    title: "Stay connected",
    body: "Message friends one-on-one or start a group chat for the whole crew. Share photos, plans, and the day's catch.",
  },
  {
    icon: LifeBuoy,
    emoji: "🆘",
    title: "Help is one tap away",
    body: "In an emergency, the SOS button shares your exact location with nearby boaters and your friends — so help can find you fast.",
  },
];

export function Onboarding() {
  const [visible, setVisible] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const updateMe = useUpdateMe();
  const { setLakeId } = useLake();
  const queryClient = useQueryClient();
  const [chosenLakeId, setChosenLakeId] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable; skip onboarding
    }
  }, []);

  const finish = (to?: string) => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    if (to) navigate(to);
  };

  if (!visible) return null;

  const onLakePicker = step === SLIDES.length;
  const onPayoff = step === SLIDES.length + 1;

  if (onLakePicker) {
    const selected = chosenLakeId ?? (me as any)?.primaryLakeId ?? DEFAULT_LAKE_ID;
    const confirmLake = () => {
      // Best-effort save; don't block onboarding if the request fails.
      updateMe.mutate(
        { data: { primaryLakeId: selected } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }) },
      );
      setLakeId(selected);
      setStep((s) => s + 1);
    };
    return (
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary/20 to-cyan-500/10 px-6 pt-8 pb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-card shadow-md flex items-center justify-center text-3xl mx-auto mb-2">
              🌊
            </div>
            <h2 className="text-xl font-bold">Pick your home lake</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This is the community you'll see first. You can browse other lakes anytime.
            </p>
          </div>
          <div className="max-h-[40vh] overflow-y-auto px-3 py-2">
            {LAKES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setChosenLakeId(l.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  l.id === selected ? "bg-primary/10" : "hover:bg-muted"
                }`}
                data-testid={`onboarding-lake-${l.id}`}
              >
                <Waves className="w-4 h-4 shrink-0 text-teal-600" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{l.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{l.region}</span>
                </span>
                {l.id === selected && <Check className="w-4 h-4 shrink-0 text-teal-600" />}
              </button>
            ))}
          </div>
          <div className="px-6 pb-6 pt-3">
            <Button className="w-full" onClick={confirmLake} data-testid="button-confirm-home-lake">
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (onPayoff) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary/20 to-cyan-500/10 px-6 pt-10 pb-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-card shadow-md flex items-center justify-center text-4xl mb-2">
              🎉
            </div>
          </div>
          <div className="px-6 pb-6 -mt-4 text-center">
            <h2 className="text-xl font-bold mb-2">You're all set</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Pick where to start — explore the map or log your first catch. You can always do both later.
            </p>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => finish("/map")}>
                <Map className="w-4 h-4 mr-2" /> Explore the map
              </Button>
              <Button variant="outline" className="w-full" onClick={() => finish("/catches")}>
                <Fish className="w-4 h-4 mr-2" /> Log a catch
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => finish("/feed")}>
                See what's happening
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary/20 to-cyan-500/10 px-6 pt-10 pb-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-card shadow-md flex items-center justify-center text-4xl mb-2">
            {slide.emoji}
          </div>
        </div>

        <div className="px-6 pb-6 -mt-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold mb-2">{slide.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{slide.body}</p>

          <div className="flex items-center justify-center gap-1.5 my-5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" className="flex-1" onClick={() => finish()}>
                Skip
              </Button>
            )}
            <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
              {isLast ? "Get started" : "Next"}
              {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
