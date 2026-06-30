import { Link } from "wouter";
import {
  LifeBuoy,
  Mail,
  ShieldCheck,
  Flag,
  Lock,
  FileText,
  ArrowRight,
} from "lucide-react";

const SUPPORT_EMAIL = "gillie.apphelp@yahoo.com";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I create an account?",
    a: (
      <>
        Open Gillie and tap <strong>Sign Up</strong> on the welcome screen. Enter
        your email address, name, and a password, then confirm your email with
        the verification code we send you. Once verified, you can set up your
        profile and join the Dale Hollow Lake community.
      </>
    ),
  },
  {
    q: "How do I reset my password?",
    a: (
      <>
        On the sign-in screen, choose the option to reset or recover your
        account and enter the email address you signed up with. Follow the
        instructions we email you to get back into your account. If you no longer
        have access to that email address, contact us at the support address
        below and we'll help you regain access.
      </>
    ),
  },
  {
    q: "How do I report a user?",
    a: (
      <>
        Open the person's profile, tap the menu button (<strong>•••</strong>) in
        the top corner, and choose <strong>Report</strong>. Tell us briefly what's
        wrong. Reports are confidential and reviewed by our moderation team.
      </>
    ),
  },
  {
    q: "How do I block a user?",
    a: (
      <>
        Open the person's profile, tap the menu button (<strong>•••</strong>),
        and choose <strong>Block</strong>. Blocked users can no longer message
        you, see your location, or interact with your content. You can manage
        blocked accounts at any time in <strong>Settings → Blocked Users</strong>.
      </>
    ),
  },
  {
    q: "How do I report a post?",
    a: (
      <>
        Tap the menu button (<strong>•••</strong>) on any post, pin, photo, or
        message and choose <strong>Report</strong>. The content is flagged for
        our moderation team to review.
      </>
    ),
  },
  {
    q: "How do I delete my account?",
    a: (
      <>
        Go to <strong>Settings → Account</strong> and tap{" "}
        <strong>Delete Account</strong>. This permanently removes your account
        and your content from Gillie and cannot be undone.
      </>
    ),
  },
  {
    q: "How do I check in and share my location?",
    a: (
      <>
        Your location is <strong>never shared automatically</strong>. To appear
        on the map, tap <strong>Check In</strong> and confirm — your location is
        then shared for that session only. Check-ins expire on their own (within
        a few hours), and you can tap <strong>Stop</strong> to end sharing
        instantly. Sharing also clears whenever you close the app or log out. You
        can manage all of this from the map or in <strong>Settings</strong>.
      </>
    ),
  },
];

export function SupportPage() {
  return (
    <div className="min-h-[100dvh] bg-muted/20 text-foreground">
      <header className="border-b border-border bg-card shadow-sm">
        <div
          className="mx-auto flex max-w-2xl items-center gap-3 px-5 pb-4"
          style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
        >
          <img
            src={`${basePath}/logo.svg`}
            alt="Gillie"
            className="h-10 w-10 rounded-xl"
          />
          <div>
            <h1 className="text-2xl font-bold text-primary leading-tight">
              Gillie Support
            </h1>
            <p className="text-sm text-muted-foreground">
              Help for the Dale Hollow Lake community app
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-5 py-8 pb-20">
        <section className="space-y-3">
          <p className="text-base leading-relaxed">
            Welcome to Gillie Support. This is the place to get help with the
            Gillie app — from creating an account and managing your privacy to
            reporting content and keeping the community safe. Browse the common
            questions below, and if you still need a hand, reach out to us
            directly.
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Contact us</h2>
              <p className="text-sm text-muted-foreground">
                Have a question that isn't answered below? Email our support team
                and we'll get back to you.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-1 inline-flex items-center gap-2 font-semibold text-primary hover:underline"
                data-testid="link-support-email"
              >
                <Mail className="h-4 w-4" />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <h3 className="text-base font-bold text-foreground">{q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Reporting & moderation */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Flag className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold">
                Reporting inappropriate content
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Inappropriate or objectionable content can be reported directly
                from within the app — use the report option on any post, pin,
                photo, message, or profile.
              </p>
              <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Every report is reviewed by the Gillie moderation team. We may
                  remove content and suspend or ban accounts that violate our
                  guidelines. There is no tolerance for objectionable content or
                  abusive users.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Legal links */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Policies</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/privacy-policy"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              data-testid="link-privacy-policy"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <Lock className="h-5 w-5" />
                </span>
                <span className="font-semibold">Privacy Policy</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/terms"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              data-testid="link-terms-of-service"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="font-semibold">Terms of Service</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/community-guidelines"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              data-testid="link-community-guidelines"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="font-semibold">Community Guidelines</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>
            Gillie — a community app for visitors of Dale Hollow Lake.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block font-semibold text-primary hover:underline"
          >
            Return to the app
          </Link>
        </footer>
      </main>
    </div>
  );
}
