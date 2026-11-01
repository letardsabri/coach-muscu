/** Résumé nutrition du jour sur le tableau de bord : calories restantes et protéines. */
import { dayKey } from '../../lib/dates';
import { useNutritionDay } from './useNutrition';

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function NutritionCard({ onOpen }: { onOpen: () => void }) {
  const data = useNutritionDay(dayKey());
  if (!data) return null;
  const { totals, targets } = data;

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
    </section>
  );
}
