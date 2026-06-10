export const WAIVER_VERSION = "1.1";

export function WaiverBody() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <p className="text-base">
        Before you jump in, please read and agree to the following:
      </p>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Be Safe</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Follow all local laws and posted regulations.</li>
          <li>Respect the lake, wildlife, and fellow visitors.</li>
          <li>Keep the area clean and pack out your trash.</li>
          <li>Use proper safety equipment and exercise caution at all times.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Use at Your Own Risk</h3>
        <p className="text-muted-foreground">
          Outdoor activities such as boating, fishing, swimming, hiking, and
          exploring carry inherent risks. By using this app, you acknowledge and
          accept those risks.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Liability Waiver</h3>
        <p className="text-muted-foreground">
          Gillie is provided for informational and community purposes only.
          Information within the app may not always be accurate, complete, or up
          to date. By using Gillie, you agree that Gillie, its owner, operators,
          affiliates, and contributors are not responsible for any injury,
          death, loss, damage, accident, or other claim arising from your use of
          the app or participation in any activity referenced within it.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Your Agreement</h3>
        <p className="text-muted-foreground">
          By selecting "I Agree", you confirm that you have read and understood
          this notice, accept all risks associated with your activities, and
          agree not to hold Gillie or its operators liable for any claims or
          damages.
        </p>
      </section>
    </div>
  );
}
