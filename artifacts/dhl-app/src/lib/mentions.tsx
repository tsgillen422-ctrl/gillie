import React from "react";
import { Link } from "wouter";

export const MENTION_RE = /@\[([^\]]+)\]\((user|business):(\d+)\)/g;

// Convert raw mention markup into plain text with "@Name" labels.
export function stripMentions(text: string): string {
  if (!text) return "";
  return text.replace(MENTION_RE, (_m, name) => `@${name}`);
}

// Renders text, turning mention markup into wouter <Link>s. Whitespace is
// expected to be preserved by the parent (e.g. whitespace-pre-wrap).
export function MentionText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, "g");
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, name, kind, id] = match;
    const href = kind === "business" ? `/businesses/${id}` : `/profile/${id}`;
    parts.push(
      <Link
        key={`mention-${key++}`}
        href={href}
        className="font-semibold text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        @{name}
      </Link>,
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <span className={className}>{parts}</span>;
}
