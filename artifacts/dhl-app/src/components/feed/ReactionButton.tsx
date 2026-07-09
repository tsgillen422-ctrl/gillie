import React from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { REACTIONS, REACTION_MAP, DEFAULT_REACTION, type ReactionKey } from "@/lib/reactions";

// Shared reaction button for posts and catches. `target` is anything with
// myReaction / reactionCounts / likeCount fields.
export function ReactionButton({ target, onReact }: { target: any; onReact: (reaction: ReactionKey) => void }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);

  const current = target.myReaction ? REACTION_MAP[target.myReaction] : null;
  const counts: Record<string, number> = target.reactionCounts || {};
  const total = target.likeCount || 0;
  const topEmojis = REACTIONS.filter((r) => (counts[r.key] || 0) > 0)
    .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0))
    .slice(0, 3)
    .map((r) => r.emoji);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    longPressed.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressed.current = true;
      setPickerOpen(true);
    }, 350);
  };

  const handleClick = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onReact((target.myReaction as ReactionKey) || DEFAULT_REACTION);
  };

  const choose = (key: ReactionKey) => {
    setPickerOpen(false);
    longPressed.current = false;
    onReact(key);
  };

  React.useEffect(() => () => clearTimer(), []);

  return (
    <div className="relative">
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-50 flex gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-xl animate-in zoom-in-95 duration-200">
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => choose(r.key)}
                aria-label={r.label}
                title={r.label}
                className={`text-2xl leading-none transition-transform hover:scale-125 active:scale-110 ${target.myReaction === r.key ? "scale-110" : ""}`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={`select-none rounded-full px-3 font-semibold transition-colors hover:bg-muted/50 ${current ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        data-testid="button-react"
      >
        {current ? (
          <span className="mr-2 text-base leading-none animate-in zoom-in-50 duration-200">{current.emoji}</span>
        ) : topEmojis.length > 0 ? (
          <span className="mr-2 text-base leading-none">{topEmojis.join("")}</span>
        ) : (
          <Heart className="w-4 h-4 mr-2" />
        )}
        {total > 0 ? total : "Like"}
      </Button>
    </div>
  );
}
