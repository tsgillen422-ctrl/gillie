import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { searchUsers } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

type MentionTextareaProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

// A controlled Textarea with @-mention autocomplete. The raw mention markup
// (`@[Display Name](user:123)`) is kept directly in the textarea value.
export function MentionTextarea({ value, onChange, ...props }: MentionTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [results, setResults] = React.useState<User[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  // Position in the string where the current "@partial" starts.
  const mentionStartRef = React.useRef<number | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = () => {
    setOpen(false);
    setResults([]);
    mentionStartRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };

  // Look backwards from the caret for an active "@partial" token (no spaces).
  const detectMention = (text: string, caret: number) => {
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        const before = i > 0 ? text[i - 1] : " ";
        if (/\s|[([]/.test(before) || i === 0) {
          return { start: i, query: text.slice(i + 1, caret) };
        }
        return null;
      }
      if (/\s/.test(ch) || ch === "]" || ch === ")") return null;
      i--;
    }
    return null;
  };

  const runSearch = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchUsers({ q: query });
        setResults(users.slice(0, 6));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart ?? text.length;
    const mention = detectMention(text, caret);
    if (mention && mention.query.length >= 1) {
      mentionStartRef.current = mention.start;
      setOpen(true);
      runSearch(mention.query);
    } else {
      closeMenu();
    }
  };

  const selectUser = (user: User) => {
    const start = mentionStartRef.current;
    const el = textareaRef.current;
    if (start == null || !el) return;
    const caret = el.selectionStart ?? value.length;
    const name = user.displayName || user.username || "user";
    const markup = `@[${name}](user:${user.id}) `;
    const next = value.slice(0, start) + markup + value.slice(caret);
    onChange(next);
    closeMenu();
    requestAnimationFrame(() => {
      const pos = start + markup.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            closeMenu();
          }
          props.onKeyDown?.(e);
        }}
        onBlur={(e) => {
          // Delay so a click on a result can register first.
          setTimeout(() => closeMenu(), 150);
          props.onBlur?.(e);
        }}
      />
      {open && (results.length > 0 || loading) && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
          data-testid="mention-autocomplete"
        >
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectUser(user)}
                data-testid={`mention-result-${user.id}`}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover-elevate active:scale-[0.99]"
              >
                <UserAvatar
                  name={user.displayName || user.username || "User"}
                  username={user.username || ""}
                  avatarUrl={user.avatarUrl}
                  className="h-8 w-8"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {user.displayName || user.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{user.username}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
