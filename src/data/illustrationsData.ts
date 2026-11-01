/**
 * Correspondance exercice / séance → image (illustrations.json). Changer un chemin suffit pour
 * remplacer un SVG provisoire par une image WebP, sans toucher au code.
 */
import { z } from 'zod';
import raw from './illustrations.json';

const path = z.string().regex(/^illustrations\/[A-Za-z0-9_/-]+\.(svg|webp|png|jpg)$/);
const schema = z.object({
  exercices: z.record(z.string(), path),
  souplesse: z.record(z.string(), path),
  seances: z.record(z.string(), path),
});

export type IllustrationKind = keyof z.infer<typeof schema>;

export const illustrations = schema.parse(raw);

/** URL de l'image, ou undefined si aucune n'est prévue (le composant affiche alors un placeholder). */
export function illustrationUrl(kind: IllustrationKind, id: string): string | undefined {
  const p = illustrations[kind][id];
  return p ? `${import.meta.env.BASE_URL}${p}` : undefined;
}
