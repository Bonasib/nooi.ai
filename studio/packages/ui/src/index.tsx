import type { ReactNode } from "react";
import { Icon } from "./icons";
export { Icon, ICON_NAMES } from "./icons";
export type { IconName } from "./icons";

export function Btn(p: { icon?: string; children?: ReactNode; label?: string; onClick?: () => void; primary?: boolean; ghost?: boolean; danger?: boolean; pressed?: boolean; disabled?: boolean; title?: string; kbd?: string; className?: string; testid?: string }) {
  const cls = ["ns-btn", p.primary && "primary", p.ghost && "ghost", p.danger && "danger", !p.children && "icon", p.className].filter(Boolean).join(" ");
  const tip = p.title || p.label;
  return (
    <button type="button" className={cls} onClick={p.onClick} disabled={p.disabled} aria-pressed={p.pressed} aria-label={p.children ? undefined : p.label} title={tip ? tip + (p.kbd ? " (" + p.kbd + ")" : "") : undefined} data-testid={p.testid}>
      {p.icon && <Icon name={p.icon} />}{p.children}
    </button>
  );
}
export function Seg<T extends string>(p: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ns-seg" role="group" aria-label={p.label}>
      {p.options.map((o) => <button type="button" key={o.v} aria-pressed={o.v === p.value} onClick={() => p.onChange(o.v)}>{o.label}</button>)}
    </div>
  );
}
export function Slider(p: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; onCommit?: () => void; onStart?: () => void; fmt?: (v: number) => string; testid?: string }) {
  const shown = p.fmt ? p.fmt(p.value) : (Math.round(p.value * 100) / 100) + (p.unit || "");
  return (
    <label className="ns-field" data-testid={p.testid}>
      <span>{p.label}<b dir="ltr">{shown}</b></span>
      <input className="ns-range" type="range" min={p.min} max={p.max} step={p.step ?? 0.01} value={p.value}
        onPointerDown={p.onStart} onChange={(e) => p.onChange(+e.target.value)} onPointerUp={p.onCommit} onKeyUp={p.onCommit} aria-label={p.label} />
    </label>
  );
}
