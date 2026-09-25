import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<
  OrderStatus,
  { label: string; icon: LucideIcon; cls: string }
> = {
  delivered: {
    label: "Delivered",
    icon: Check,
    cls: "text-[var(--status-delivered)] border-[color-mix(in_oklch,var(--status-delivered)_35%,white)] bg-[color-mix(in_oklch,var(--status-delivered)_8%,white)]",
  },
  on_route: {
    label: "On route",
    icon: Truck,
    cls: "text-[var(--status-progress)] border-[color-mix(in_oklch,var(--status-progress)_35%,white)] bg-[color-mix(in_oklch,var(--status-progress)_8%,white)]",
  },
  scheduled: {
    label: "Scheduled",
    icon: CircleDashed,
    cls: "text-[var(--status-attention)] border-[color-mix(in_oklch,var(--status-attention)_35%,white)] bg-[color-mix(in_oklch,var(--status-attention)_10%,white)]",
  },
  pending: {
    label: "Pending",
    icon: CircleDashed,
    cls: "text-[var(--status-pending)] border-border bg-muted",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    cls: "text-[var(--status-failed)] border-[color-mix(in_oklch,var(--status-failed)_35%,white)] bg-[color-mix(in_oklch,var(--status-failed)_8%,white)]",
  },
};

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const s = STATUS_MAP[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        s.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {s.label}
    </span>
  );
}

export function SubBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "text-[var(--status-delivered)] bg-[color-mix(in_oklch,var(--status-delivered)_8%,white)] border-[color-mix(in_oklch,var(--status-delivered)_30%,white)]",
    paused: "text-[var(--status-attention)] bg-[color-mix(in_oklch,var(--status-attention)_10%,white)] border-[color-mix(in_oklch,var(--status-attention)_30%,white)]",
    expired: "text-[var(--status-pending)] bg-muted border-border",
    cancelled: "text-[var(--status-failed)] bg-[color-mix(in_oklch,var(--status-failed)_8%,white)] border-[color-mix(in_oklch,var(--status-failed)_30%,white)]",
  };
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

export function Tile({
  label,
  value,
  active,
  onClick,
  tone = "default",
}: {
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "delivered" | "progress" | "attention" | "failed";
}) {
  const toneCls: Record<string, string> = {
    default: "text-foreground",
    delivered: "text-[var(--status-delivered)]",
    progress: "text-[var(--status-progress)]",
    attention: "text-[var(--status-attention)]",
    failed: "text-[var(--status-failed)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={cn(
        "min-w-[124px] flex-1 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent",
        active ? "border-foreground/40 ring-1 ring-foreground/20" : "border-border",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("tnum mt-0.5 text-xl font-semibold", toneCls[tone])}>{value}</div>
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  size = "sm",
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "xs";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const v: Record<string, string> = {
    default: "border border-border bg-card hover:bg-accent text-foreground",
    primary: "border border-transparent bg-brand text-brand-foreground hover:brightness-95 font-medium",
    ghost: "border border-transparent hover:bg-accent text-muted-foreground hover:text-foreground",
    danger: "border border-border bg-card text-[var(--status-failed)] hover:bg-accent",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md transition-colors disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-7 px-2 text-[12px]",
        v[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[13px] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface-raised py-16 text-center">
      <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
      <div className="text-[14px] font-medium">{title}</div>
      {hint ? <div className="text-[12px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function SkeletonRows({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-8 rounded" />
      ))}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
      {right}
    </div>
  );
}
