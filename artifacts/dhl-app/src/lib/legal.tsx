export const PRIVACY_POLICY_UPDATED = "July 9, 2026";
export const COMMUNITY_GUIDELINES_UPDATED = "June 11, 2026";
export const TERMS_OF_SERVICE_UPDATED = "June 27, 2026";

// Bump this whenever the Terms of Service, Privacy Policy, or Community
// Guidelines change in a way that requires renewed consent. Any user whose
// stored termsVersion differs from this value (including new users with none)
// is re-prompted by TermsGate before they can use the app.
// 1.1 (Jul 9, 2026): location sharing changed from expiring manual check-ins to
// persistent opt-in sharing with "last seen" + 24h auto-ghost — a material
// privacy change, so all users must re-accept.
export const TERMS_VERSION = "1.1";

export function PrivacyPolicyBody() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <p className="text-muted-foreground">Last updated: {PRIVACY_POLICY_UPDATED}</p>

      <p className="text-base">
        Gillie ("we", "us") is a community app for lake visitors.
        This policy explains what information we collect, how we use it, and the
        choices you have.
      </p>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Information We Collect</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>Account info:</strong> your name, username, email address, and
            profile photo, provided when you sign up.
          </li>
          <li>
            <strong>Content you create:</strong> posts, photos, catches, pins,
            comments, and messages you choose to share.
          </li>
          <li>
            <strong>Location:</strong> your boat's location on the lake, only if you
            choose to turn on location sharing. After you opt in, your position
            updates while the app is open; when you close the app, approved friends
            see your last location with a "last seen" time. If you don't open the
            app for 24 hours, your location is removed from the map automatically,
            and you can hide instantly at any time with Ghost Mode.
          </li>
          <li>
            <strong>Usage data:</strong> basic technical information needed to keep
            the app running and secure.
          </li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">How We Use Your Information</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>To provide the app's features, such as the map, feed, and messaging.</li>
          <li>To show your content and location to the audience you choose.</li>
          <li>To keep the community safe, including reviewing reported content.</li>
          <li>To send notifications you have enabled.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Your Choices &amp; Controls</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Location sharing is off until you explicitly turn it on, and only approved friends can ever see you. Turn on Ghost Mode at any time to hide instantly — sharing stays off until you choose to share again.</li>
          <li>Control who can see your location, followers, and friends list.</li>
          <li>Block or report other users and content.</li>
          <li>Edit your profile and content at any time.</li>
          <li>
            <strong>Delete your account:</strong> you can permanently delete your
            account and all of your content from Settings → Account at any time.
          </li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Sharing &amp; Disclosure</h3>
        <p className="text-muted-foreground">
          We do not sell your personal information. Content and location you share
          are visible to other users according to your privacy settings. We may
          disclose information if required by law or to protect the safety of our
          community.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Data Retention</h3>
        <p className="text-muted-foreground">
          We keep your information for as long as your account is active. When you
          delete your account, your personal data and content are permanently
          removed from the app.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Contact</h3>
        <p className="text-muted-foreground">
          If you have questions about this policy or your data, please contact us
          through the app's support channels.
        </p>
      </section>
    </div>
  );
}

export function CommunityGuidelinesBody() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <p className="text-muted-foreground">Last updated: {COMMUNITY_GUIDELINES_UPDATED}</p>

      <p className="text-base">
        Gillie is built for lake communities. To keep it welcoming
        and safe for everyone, we ask all members to follow these guidelines.
        Content or behavior that violates them may be removed, and accounts may be
        suspended or banned.
      </p>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Be Respectful</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Treat other members with kindness and respect.</li>
          <li>No harassment, bullying, hate speech, or threats of any kind.</li>
          <li>Do not target people based on who they are.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Keep It Appropriate</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>No nudity, sexually explicit material, or pornography.</li>
          <li>No graphic violence or gratuitously disturbing content.</li>
          <li>
            Content flagged as mature is blurred by default and can be revealed in
            Settings.
          </li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">No Illegal or Harmful Activity</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Do not post content that promotes illegal acts or endangers others.</li>
          <li>No spam, scams, or misleading content.</li>
          <li>Respect the lake, wildlife, and posted regulations.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Respect Privacy</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Do not share other people's private information without consent.</li>
          <li>Only post photos of others when it's appropriate to do so.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Reporting &amp; Enforcement</h3>
        <p className="text-muted-foreground">
          If you see something that breaks these guidelines, use the report option
          on the post, pin, message, or profile, or block the user. Our team
          reviews reports and may remove content or take action on accounts that
          violate these rules. There is no tolerance for objectionable content or
          abusive users.
        </p>
      </section>
    </div>
  );
}

export function TermsOfServiceBody() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <p className="text-muted-foreground">Last updated: {TERMS_OF_SERVICE_UPDATED}</p>

      <p className="text-base">
        These Terms of Service ("Terms") are a legal agreement between you and
        Gillie ("we", "us") governing your use of the Gillie app and services.
        By creating an account or using the app, you agree to these Terms, our{" "}
        <strong>Privacy Policy</strong>, and our{" "}
        <strong>Community Guidelines</strong>. If you do not agree, do not use
        the app.
      </p>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Eligibility</h3>
        <p className="text-muted-foreground">
          You must be at least 13 years old (or the minimum age required in your
          location) to use Gillie. By using the app you confirm that you meet
          this requirement and that the information you provide is accurate.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Your Account</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>You are responsible for activity that happens under your account.</li>
          <li>Keep your login credentials secure and do not share your account.</li>
          <li>You may delete your account at any time from Settings → Account.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Acceptable Use &amp; Content</h3>
        <p className="text-muted-foreground">
          You are responsible for the content you post. You agree to follow our
          Community Guidelines and not to post content that is objectionable,
          illegal, abusive, harassing, hateful, or that infringes others'
          rights.
        </p>
        <p className="text-muted-foreground">
          <strong>Zero tolerance:</strong> there is no tolerance for
          objectionable content or abusive behavior. You can report content from
          any post, pin, photo, message, or profile, and you can block other
          users. We review reports and may remove content and suspend or
          terminate accounts that violate these Terms or our Community
          Guidelines.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Your Content &amp; License</h3>
        <p className="text-muted-foreground">
          You keep ownership of the content you create. By posting, you grant us
          a limited license to host and display that content within the app so it
          can be shown to the audience you choose.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Location Features</h3>
        <p className="text-muted-foreground">
          Gillie only shares your location if you explicitly turn on location
          sharing, and only with friends you've approved. Your position updates
          while the app is open; your last location remains visible with a "last
          seen" time and is removed automatically after 24 hours without app
          activity. You can hide instantly at any time with Ghost Mode. You are
          responsible for deciding when to share your location.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Disclaimers &amp; Limitation of Liability</h3>
        <p className="text-muted-foreground">
          Gillie is provided "as is" for informational and community purposes
          only. Information in the app may not be accurate, complete, or current.
          Outdoor activities carry inherent risks. To the fullest extent
          permitted by law, Gillie and its operators are not liable for any
          injury, loss, or damages arising from your use of the app or any
          activity referenced within it.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Termination</h3>
        <p className="text-muted-foreground">
          We may suspend or terminate access to accounts that violate these
          Terms. You may stop using the app and delete your account at any time.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Changes to These Terms</h3>
        <p className="text-muted-foreground">
          We may update these Terms from time to time. When we make material
          changes, we will ask you to review and accept the updated Terms before
          continuing to use the app.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Contact</h3>
        <p className="text-muted-foreground">
          If you have questions about these Terms, please contact us through the
          app's support channels.
        </p>
      </section>
    </div>
  );
}
