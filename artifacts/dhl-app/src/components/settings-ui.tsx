import React from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/**
 * iOS / Facebook style settings primitives.
 * - SettingsShell: detail-page scaffold with a sticky back header.
 * - SettingsGroup: inset-grouped section (optional header + footer note).
 * - SettingsLinkRow / SettingsExternalRow / SettingsButtonRow: compact rows
 *   with an icon and chevron that navigate or trigger an action.
 * - SettingsSwitchRow: a compact row with a trailing toggle.
 */

export function SettingsShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-y-auto">
      <div
        className="px-2 pb-3 border-b border-border bg-card shadow-sm sticky top-0 z-10 flex items-center gap-1"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <Link href="/settings">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to Settings"
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-primary flex-1 truncate">{title}</h1>
        {action}
      </div>
      <div className="p-4 max-w-md mx-auto w-full pb-24">{children}</div>
    </div>
  );
}

export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {title && (
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">
          {title}
        </h2>
      )}
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
      {footer && (
        <p className="text-xs text-muted-foreground px-4 mt-2 leading-relaxed">
          {footer}
        </p>
      )}
    </div>
  );
}

function RowIcon({
  icon: Icon,
  tone = "primary",
}: {
  icon: LucideIcon;
  tone?: "primary" | "muted" | "destructive";
}) {
  const toneClass =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "muted"
      ? "bg-muted text-muted-foreground"
      : "bg-primary/10 text-primary";
  return (
    <span
      className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${toneClass}`}
    >
      <Icon className="w-[18px] h-[18px]" />
    </span>
  );
}

type RowProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  tone?: "primary" | "muted" | "destructive";
  danger?: boolean;
};

function RowBody({ icon, label, value, tone, danger }: RowProps) {
  return (
    <>
      <RowIcon icon={icon} tone={tone ?? (danger ? "destructive" : "primary")} />
      <span
        className={`flex-1 text-[15px] font-medium truncate ${
          danger ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </span>
      {value && (
        <span className="text-sm text-muted-foreground truncate max-w-[45%] text-right">
          {value}
        </span>
      )}
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </>
  );
}

const rowClass =
  "flex w-full items-center gap-3 px-4 py-3 min-h-[52px] text-left transition-colors hover:bg-muted/60 active:bg-muted";

export function SettingsLinkRow(props: RowProps & { href: string }) {
  const { href, ...rest } = props;
  return (
    <Link href={href} className={rowClass} data-testid={`row-${slug(props.label)}`}>
      <RowBody {...rest} />
    </Link>
  );
}

export function SettingsExternalRow(
  props: RowProps & { href: string; testId?: string }
) {
  const { href, testId, ...rest } = props;
  return (
    <a href={href} className={rowClass} data-testid={testId ?? `row-${slug(props.label)}`}>
      <RowBody {...rest} />
    </a>
  );
}

export function SettingsButtonRow(
  props: RowProps & { onClick: () => void; testId?: string }
) {
  const { onClick, testId, ...rest } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={rowClass}
      data-testid={testId ?? `row-${slug(props.label)}`}
    >
      <RowBody {...rest} />
    </button>
  );
}

export function SettingsSwitchRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  tone?: "primary" | "muted";
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
      <RowIcon icon={Icon} tone={tone} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-[state=checked]:bg-primary shrink-0"
        aria-label={label}
      />
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
