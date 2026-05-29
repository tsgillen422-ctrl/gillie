import React from "react";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function colorFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function UserAvatar({
  name,
  username,
  avatarUrl,
  className = "w-10 h-10",
  online = false,
}: {
  name: string;
  username: string;
  avatarUrl?: string | null;
  className?: string;
  online?: boolean;
}) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover border border-border/50"
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold select-none border border-black/5"
          style={{ backgroundColor: colorFromString(username || name) }}
        >
          <span style={{ fontSize: "42%" }}>{initials(name)}</span>
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-1/4 h-1/4 min-w-[10px] min-h-[10px] bg-emerald-500 border-2 border-background rounded-full" />
      )}
    </div>
  );
}
