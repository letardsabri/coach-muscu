/**
 * Recommandations du coach en attente : règle, explication chiffrée, et un tap pour appliquer.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import type { Recommendation } from '../../db/models';
import { RULE_LABELS } from '../../ui/format';
import { applyRecommendation, dismissRecommendation } from './coachRepo';

export function Recommendations() {
  const pending = useLiveQuery(() => db.recommendations.where('status').equals('pending').reverse().sortBy('createdAt'), []);
  if (!pending || pending.length === 0) return null;
  return (
    <section className="card coach-card" aria-label="Recommandations du coach">
      <div className="spread">
        <h3 className="card-h">Coach</h3>
        <span className="chip chip-accent num">{pending.length}</span>
      </div>
      {pending.map((r) => (
        <RecommendationItem key={r.id} rec={r} />
      ))}
    </section>
  );
}

function RecommendationItem({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionable = rec.change !== undefined;
  return (
    <article className="rec">
      <button className="rec-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`chip ${actionable ? 'chip-accent' : ''}`}>
          {rec.rule} · {RULE_LABELS[rec.rule]}
        </span>
        <b>{rec.title}</b>
      </button>
      <p className={`rec-text${open ? ' open' : ''}`} onClick={() => setOpen(true)}>
        {rec.explanation}
      </p>
      <div className="rec-actions">
        {actionable ? (
          <>
            <button
              className="btn-primary rec-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await applyRecommendation(rec);
              }}
            >
              Appliquer
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => void dismissRecommendation(rec.id)}>
              Ignorer
            </button>
          </>
        ) : (
          <button className="btn-ghost" onClick={() => void dismissRecommendation(rec.id)}>
            Compris
          </button>
        )}
      </div>
    </article>
  );
}
