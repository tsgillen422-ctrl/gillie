export const PRIVACY_POLICY_UPDATED = "June 11, 2026";
export const COMMUNITY_GUIDELINES_UPDATED = "June 11, 2026";

export function PrivacyPolicyBody() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <p className="text-muted-foreground">Last updated: {PRIVACY_POLICY_UPDATED}</p>

      <p className="text-base">
        Gillie ("we", "us") is a community app for visitors of Dale Hollow Lake.
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
            <strong>Location:</strong> your boat's location on the lake, only when
            you turn on location sharing. You can stop sharing at any time.
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
          <li>Turn location sharing on or off whenever you like (Ghost Mode).</li>
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
        Gillie is built for the Dale Hollow Lake community. To keep it welcoming
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
