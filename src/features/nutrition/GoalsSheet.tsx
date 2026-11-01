/**
 * Objectifs nutritionnels : réglages du calcul et explication pas à pas.
 */
import { nutritionConfig } from '../../data/nutritionData';
import type { NutritionSettings } from '../../db/models';
import type { Targets } from '../../engine/nutrition';
import { NumberField, Segmented, Sheet, Stepper, Toggle } from '../../ui/components';
import { updateNutritionSettings } from './nutritionRepo';

export function GoalsSheet(props: { settings: NutritionSettings; targets: Targets | null; weightKg: number; onClose: () => void }) {
  const s = props.settings;
  const set = (patch: Partial<NutritionSettings>) => void updateNutritionSettings(patch);
  const setManual = (key: 'kcal' | 'prot', v: number | null) => {
    const manual = { ...(s.manual ?? {}) };
    if (v === null) delete manual[key];
    else manual[key] = v;
    set({ manual: Object.keys(manual).length ? manual : null });
  };

  return (
    <Sheet title="Objectifs" onClose={props.onClose}>
      <div className="field">
        <span>Sexe (utilisé par la formule de calcul)</span>
        <Segmented
          ariaLabel="Sexe"
          value={s.sex ?? 'none'}
          onChange={(v) => set({ sex: v === 'none' ? null : (v as 'homme' | 'femme') })}
          options={[
            { value: 'homme', label: 'Homme' },
            { value: 'femme', label: 'Femme' },
            { value: 'none', label: 'Non renseigné' },
          ]}
        />
      </div>

      <div className="field">
        <span>Activité hors sport</span>
        <div className="choice-list">
          {nutritionConfig.activityLevels.map((l) => (
            <button key={l.id} className={s.activity === l.id ? 'on' : ''} onClick={() => set({ activity: l.id })}>
              <b>{l.label}</b>
              <small>
                {l.hint} · ×{l.factor.toLocaleString('fr-FR')}
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Déficit quotidien</span>
        <Segmented
          ariaLabel="Déficit"
          value={s.deficitKcal}
          onChange={(v) => set({ deficitKcal: v })}
          options={nutritionConfig.limits.deficitChoices.map((d) => ({ value: d, label: d === 0 ? 'Maintien' : `−${d}`, hint: d === 400 ? 'conseillé' : undefined }))}
        />
      </div>

      <Stepper
        size="md"
        label="Protéines par kg de poids objectif"
        value={s.proteinGPerKgGoal}
        onChange={(v) => set({ proteinGPerKgGoal: v })}
        step={0.1}
        min={1.2}
        max={2.6}
        unit="g/kg"
      />

      <Toggle
        label="Ajuster les jours d'entraînement"
        hint={`+${nutritionConfig.sportBonusKcal.strength} kcal séance, +${nutritionConfig.sportBonusKcal.mma_technique} MMA technique, +${nutritionConfig.sportBonusKcal.mma_intense} MMA intense`}
        checked={s.sportBonus}
        onChange={(v) => set({ sportBonus: v })}
      />

      <div className="field">
        <span>Objectifs manuels (laisser vide = calcul automatique)</span>
        <div className="inputs">
          <NumberField label="Calories" value={s.manual?.kcal ?? null} onChange={(v) => setManual('kcal', v)} unit="kcal" placeholder="auto" />
          <NumberField label="Protéines" value={s.manual?.prot ?? null} onChange={(v) => setManual('prot', v)} unit="g" placeholder="auto" />
        </div>
      </div>

      <section className="card" style={{ gap: 8 }}>
        <h3 className="card-h">Comment c'est calculé (aujourd'hui)</h3>
        {props.targets ? (
          <ol className="steps">
            {props.targets.steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            Renseigne le sexe ci-dessus pour obtenir un calcul automatique, ou fixe tes objectifs à la main.
          </p>
        )}
        <p className="faint" style={{ fontSize: 13 }}>
          Poids utilisé : {props.weightKg.toLocaleString('fr-FR')} kg (moyenne 7 jours de tes pesées). Le déficit modéré vise environ −0,3 à
          −0,5 kg par semaine : assez pour perdre du gras, assez peu pour garder ton muscle avec les protéines et la musculation. Les formules
          donnent une estimation : c'est l'évolution de ton poids sur 2 à 3 semaines qui dira s'il faut ajuster.
        </p>
      </section>
    </Sheet>
  );
}
