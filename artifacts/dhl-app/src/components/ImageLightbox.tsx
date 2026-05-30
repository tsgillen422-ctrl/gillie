import React from "react";
import { createPortal } from "react-dom";
import { X, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImageLightbox({
  src,
  alt = "",
  open,
  onClose,
  mediaType = "image",
  onDelete,
}: {
  src: string | null;
  alt?: string;
  open: boolean;
  onClose: () => void;
  mediaType?: "image" | "video";
  onDelete?: () => void;
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Modal open/close side effects. Depends only on `open` so toggling the
  // menu/confirm does not reset body scroll or bounce focus to the opener.
  React.useEffect(() => {
    if (!open) {
      setMenuOpen(false);
      setConfirmOpen(false);
      return;
    }
    previousFocus.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      previousFocus.current?.focus?.();
    };
  }, [open]);

  // Keyboard handling: Escape unwinds confirm -> menu -> lightbox, and Tab is
  // trapped within the modal. Re-binds on menu/confirm changes but performs no
  // focus/scroll side effects, so it never disrupts the user's focus.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmOpen) setConfirmOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else onClose();
        return;
      }
      if (e.key === "Tab") {
        const container = containerRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button, [href], input, video, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, menuOpen, confirmOpen]);

  if (!open || !src) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Media viewer"}
    >
      <div className="absolute top-4 right-4 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {onDelete && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-40 overflow-hidden rounded-md bg-popover text-popover-foreground shadow-lg ring-1 ring-black/10"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-7 h-7" />
        </button>
      </div>

      {mediaType === "video" ? (
        <video
          src={src}
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          controls
          autoPlay
          playsInline
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {confirmOpen && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-6"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(false); }}
        >
          <div
            className="w-full max-w-xs rounded-lg bg-background p-5 text-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Remove this item?</h3>
            <p className="mt-1 text-sm text-muted-foreground">This can't be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { setConfirmOpen(false); onClose(); onDelete?.(); }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
