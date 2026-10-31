import type { ReactNode } from 'react';

export function Stepper(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
  size?: 'lg' | 'md';
}) {
  const { value, step, min, max } = props;
  const set = (v: number) => props.onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  const shown = value.toLocaleString('fr-FR', { maximumFractionDigits: 2, useGrouping: false });
  return (
    <div className={`stepper stepper-${props.size ?? 'lg'}`}>
      <span className="stepper-label">{props.label}</span>
      <div className="stepper-row">
        <button className="stepper-btn" aria-label={`${props.label} moins`} disabled={value <= min} onClick={() => set(value - step)}>
          −
        </button>
        <span className="stepper-value num">
          {shown}
          {props.unit && <small>{props.unit}</small>}
        </span>
        <button className="stepper-btn" aria-label={`${props.label} plus`} disabled={value >= max} onClick={() => set(value + step)}>
          +
        </button>
      </div>
    </div>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{props.title}</h2>
          <button className="btn-ghost" onClick={props.onClose}>
            Fermer
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>(props: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === props.value}
          className={o.value === props.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  );
}

/** Rangée de pastilles 1–5 (forme du jour). */
export function Scale(props: { label: string; low: string; high: string; value: number; onChange: (v: number) => void; max?: number; min?: number }) {
  const min = props.min ?? 1;
  const max = props.max ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="scale">
      <div className="scale-head">
        <span>{props.label}</span>
        <small>
          {props.low} → {props.high}
        </small>
      </div>
      <div className="scale-row" role="radiogroup" aria-label={props.label}>
        {values.map((v) => (
          <button key={v} role="radio" aria-checked={v === props.value} className={v === props.value ? 'on' : ''} onClick={() => props.onChange(v)}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
