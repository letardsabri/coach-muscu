/**
 * Image d'exercice ou d'en-tête de séance : chargement différé, et placeholder sobre si l'image
 * est absente ou introuvable (jamais d'icône d'image cassée).
 */
import { useState } from 'react';
import { illustrationUrl, type IllustrationKind } from '../data/illustrationsData';

export function Illustration(props: { kind: IllustrationKind; id: string; alt: string; size: 'thumb' | 'large' | 'header' | 'banner'; className?: string }) {
  const src = illustrationUrl(props.kind, props.id);
  const [failed, setFailed] = useState<string | null>(null);
  const cls = `illu illu-${props.size}${props.className ? ` ${props.className}` : ''}`;

  if (!src || failed === src) {
    return (
      <div className={`${cls} illu-placeholder`} role="img" aria-label={props.alt}>
        <svg viewBox="0 0 48 48" aria-hidden>
          <circle cx="24" cy="12" r="5" />
          <path d="M24 18 V31 M24 22 L15 27 M24 22 L33 27 M24 31 L17 42 M24 31 L31 42" />
        </svg>
        {props.size !== 'thumb' && <span>{props.alt.charAt(0).toUpperCase()}</span>}
      </div>
    );
  }
  const [w, h] = props.size === 'header' || props.size === 'banner' ? [360, 140] : [240, 160];
  return <img className={cls} src={src} alt={props.alt} width={w} height={h} loading="lazy" decoding="async" onError={() => setFailed(src)} />;
}
