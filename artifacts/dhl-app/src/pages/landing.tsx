import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Anchor, Fish, Users, ShieldAlert, Waves } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  { icon: MapPin, title: "Live Lake Map", text: "See checked-in friends, hazards, and hot spots on Dale Hollow." },
  { icon: Fish, title: "Log Your Catches", text: "Track and share your best catches with the community." },
  { icon: Users, title: "Boater Network", text: "Follow friends, message, and find people on the water." },
  { icon: ShieldAlert, title: "Stay Safe", text: "Report hazards, share conditions, and send an SOS in a pinch." },
];

export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
        className="flex items-center justify-between px-6 pb-5 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-2.5">
          <img src={`${basePath}/logo.svg`} alt="Gillie" className="h-9 w-9 rounded-xl" />
          <span className="font-script text-2xl font-bold leading-none">Gillie</span>
        </div>
        <Link href="/sign-in">
          <Button variant="ghost" className="font-semibold">Sign In</Button>
        </Link>
      </header>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b from-primary/15 to-transparent blur-2xl" />
        <section className="relative max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Waves className="h-4 w-4" /> The lake, in your pocket
          </div>
          <h1 className="mt-6 font-display text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Your crew, your catches,<br />
            <span className="text-primary">your lake.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
            The social map for Dale Hollow Lake. Find friends on the water, drop pins,
            log catches, and stay safe — all in one place.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto px-8 text-base font-semibold gap-2">
                <Anchor className="h-5 w-5" /> Create your account
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 text-base font-semibold">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="relative max-w-5xl mx-auto px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Gillie · Made for boaters and anglers
      </footer>
    </div>
  );
}

export default LandingPage;
