/** Résumé nutrition du jour sur le tableau de bord : calories restantes, protéines et eau. */
import { liters, waterGoal } from '../../engine/hydration';
import { dayKey } from '../../lib/dates';
import { useWaterDay } from './HydrationCard';
import { addWater } from './nutritionRepo';
import { useNutritionDay } from './useNutrition';

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function NutritionCard({ onOpen }: { onOpen: () => void }) {
  const today = dayKey();
  const data = useNutritionDay(today);
  const water = useWaterDay(today);
  if (!data || !water) return null;
  const { totals, targets } = data;
  const hydration = data.profile.hydration;
  const waterMl = water.reduce((n, e) => n + e.ml, 0);
  const waterTarget = hydration ? waterGoal(hydration, data.sport).ml : null;

  return (
    <section className="card" onClick={onOpen} role="button">
      <div className="spread">
        <h3 className="card-h">Nutrition du jour</h3>
        <span className="muted num">{targets ? `objectif ${fmt(targets.kcal)} kcal` : 'objectifs à régler'}</span>
      </div>
      {targets ? (
        <>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span className="big-number num">{fmt(Math.abs(targets.kcal - totals.kcal))}</span>
            <span className="muted">kcal {totals.kcal <= targets.kcal ? 'restantes' : 'au-dessus de l’objectif'}</span>
          </div>
          <div className="macro">
            <div className="spread">
              <small style={{ fontWeight: 700 }}>Protéines</small>
              <small className="num muted">
                {fmt(totals.prot)} / {fmt(targets.prot)} g
              </small>
            </div>
            <div className="bar">
              <div style={{ width: `${Math.min(1, totals.prot / targets.prot) * 100}%` }} />
            </div>
          </div>
        </>
      ) : (
        <p className="muted" style={{ fontSize: 14 }}>
          {fmt(totals.kcal)} kcal saisies aujourd'hui. Règle tes objectifs dans l'onglet Nutrition.
        </p>
      )}
      {waterTarget !== null && (
        <div className="spread">
          <div className="macro" style={{ flex: 1 }}>
            <div className="spread">
              <small style={{ fontWeight: 700 }}>Eau</small>
              <small className="num muted">
                {liters(waterMl)} / {liters(waterTarget)}
              </small>
            </div>
            <div className="bar water-bar">
              <div style={{ width: `${Math.min(1, waterMl / waterTarget) * 100}%` }} />
            </div>
          </div>
          <button
            className="chip chip-btn chip-accent"
            aria-label="Ajouter un verre d'eau de 250 ml"
            onClick={(e) => {
              e.stopPropagation(); // n'ouvre pas l'onglet Nutrition
              void addWater(today, 250);
            }}
          >
            +250 ml
          </button>
        </div>
      )}
    </section>
  );
}
