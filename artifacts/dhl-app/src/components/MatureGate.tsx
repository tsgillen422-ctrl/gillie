import React from "react";
import { EyeOff } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

type MatureGateProps = {
  isMature?: boolean | null;
  children: React.ReactNode;
  className?: string;
  label?: string;
  rounded?: string;
};

export function MatureGate({ isMature, children, className, label, rounded = "rounded-lg" }: MatureGateProps) {
  const { data: me } = useGetMe();
  const showMature = !!(me as any)?.showMatureContent;
  const [revealed, setRevealed] = React.useState(false);

  if (!isMature || showMature || revealed) return <>{children}</>;

  return (
    <div className={`relative overflow-hidden ${rounded} ${className ?? ""}`}>
      <div className="pointer-events-none select-none blur-2xl scale-110">{children}</div>
      <button
        type="button"
        aria-label="Reveal sensitive content"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setRevealed(true);
        }}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-background/50 px-3 text-center backdrop-blur-md"
      >
        <EyeOff className="w-6 h-6 text-foreground/80" />
        <span className="text-sm font-semibold text-foreground/90">{label ?? "Sensitive content"}</span>
        <span className="text-xs text-foreground/70">Tap to view</span>
      </button>
    </div>
  );
}
