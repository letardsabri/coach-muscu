/**
 * Ajout d'un aliment : recherche + Récents / Favoris / Tout / Perso / Repas types,
 * puis quantité en portions ou en grammes. Aussi : ajout libre, création d'un aliment perso,
 * et modification d'une saisie existante.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { aliments } from '../../data/alimentsData';
import { nutritionConfig } from '../../data/nutritionData';
import { db } from '../../db/db';
import type { CustomFood, DayKey, FoodEntry, MealId } from '../../db/models';
import { scale, searchFoods } from '../../engine/nutrition';
import { NumberField, Segmented, Sheet, Stepper } from '../../ui/components';
import {
  addEntry,
  addTemplate,
  archiveCustomFood,
  buildCatalog,
  CATEGORY_LABELS,
  deleteEntry,
  deleteMealTemplate,
  entryValues,
  quantityGrams,
  saveCustomFood,
  sourceKey,
  toggleFavorite,
  updateEntry,
  type CatalogFood,
  type Quantity,
} from './nutritionRepo';

export const MEAL_SHORT: Record<MealId, string> = { petit_dejeuner: 'Matin', dejeuner: 'Midi', diner: 'Soir', collation: 'Collation' };

type Tab = 'recents' | 'favoris' | 'tout' | 'perso' | 'repas';
type View = { kind: 'browse' } | { kind: 'quantity'; food: CatalogFood } | { kind: 'free' } | { kind: 'create' };

const fmtN = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function AddFoodSheet(props: { day: DayKey; meal: MealId; onClose: () => void }) {
  const custom = useLiveQuery(() => db.customFoods.toArray(), []);
  const favorites = useLiveQuery(() => db.foodFavorites.toArray(), []);
  const templates = useLiveQuery(() => db.mealTemplates.orderBy('id').toArray(), []);
  const recent = useLiveQuery(() => db.foodEntries.orderBy('createdAt').reverse().limit(400).toArray(), []);
  const [view, setView] = useState<View>({ kind: 'browse' });
  const [meal, setMeal] = useState<MealId>(props.meal);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recents');
  const [category, setCategory] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const catalog = useMemo(() => buildCatalog(custom ?? []), [custom]);
  const byKey = useMemo(() => new Map(catalog.map((f) => [f.key, f])), [catalog]);

  /** Dernière quantité utilisée pour chaque aliment récent (ajout en un tap). */
  const lastUse = useMemo(() => {
    const map = new Map<string, FoodEntry>();
    for (const e of recent ?? []) {
      const k = sourceKey(e.source);
      if (k && !map.has(k)) map.set(k, e);
    }
    return map;
  }, [recent]);
  const recentKeys = [...lastUse.keys()];
  const favSet = new Set((favorites ?? []).map((f) => f.key));

  if (!custom || !favorites || !templates || !recent) return null;

  const showFlash = (text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 1800);
  };

  const quickAdd = async (food: CatalogFood) => {
    const last = lastUse.get(food.key);
    const q: Quantity = last?.portion
      ? { mode: 'portion', ...last.portion }
      : last?.grams
        ? { mode: 'grams', grams: last.grams }
        : { mode: 'portion', label: food.portions[0]!.label, grams: food.portions[0]!.grams, count: 1 };
    await addEntry({ day: props.day, meal, source: food.source, nom: food.nom, ...entryValues(food, q) });
    showFlash(`${food.nom} ajouté`);
  };

  if (view.kind === 'quantity') {
    return (
      <QuantitySheet
        food={view.food}
        meal={meal}
        initial={lastUse.get(view.food.key)}
        favorite={favSet.has(view.food.key)}
        onBack={() => setView({ kind: 'browse' })}
        onSave={async (q, m) => {
          await addEntry({ day: props.day, meal: m, source: view.food.source, nom: view.food.nom, ...entryValues(view.food, q) });
          props.onClose();
        }}
      />
    );
  }
  if (view.kind === 'free') {
    return <FreeEntrySheet meal={meal} onBack={() => setView({ kind: 'browse' })} onSave={async (e) => {
      await addEntry({ ...e, day: props.day });
      props.onClose();
    }} />;
  }
  if (view.kind === 'create') {
    return (
      <CreateFoodSheet
        onBack={() => setView({ kind: 'browse' })}
        onCreated={(created) => {
          const food = buildCatalog([created])[0];
          setView(food ? { kind: 'quantity', food } : { kind: 'browse' });
        }}
      />
    );
  }

  const searching = query.trim().length > 0;
  let list: CatalogFood[];
  if (searching) list = searchFoods(query, catalog, recentKeys);
  else if (tab === 'recents') list = recentKeys.map((k) => byKey.get(k)).filter((f): f is CatalogFood => Boolean(f));
  else if (tab === 'favoris') list = catalog.filter((f) => favSet.has(f.key));
  else if (tab === 'perso') list = catalog.filter((f) => f.custom);
  else list = catalog.filter((f) => !category || f.categorie === category);

  return (
    <Sheet title="Ajouter" onClose={props.onClose}>
      <Segmented
        ariaLabel="Repas"
        value={meal}
        onChange={setMeal}
        options={(Object.keys(MEAL_SHORT) as MealId[]).map((m) => ({ value: m, label: MEAL_SHORT[m] }))}
      />
      <input
        className="search"
        type="search"
        placeholder="Rechercher un aliment (ex. poulet, kebab…)"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      {!searching && (
        <div className="chips scroll-x">
          {(
            [
              ['recents', 'Récents'],
              ['favoris', 'Favoris'],
              ['tout', 'Tout'],
              ['perso', 'Mes aliments'],
              ['repas', 'Repas types'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} className={`chip chip-btn${tab === t ? ' chip-accent' : ''}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {!searching && tab === 'tout' && (
        <div className="chips scroll-x">
          <button className={`chip chip-btn${category === null ? ' chip-accent' : ''}`} onClick={() => setCategory(null)}>
            Toutes
          </button>
          {aliments.categories.map((c) => (
            <button key={c.id} className={`chip chip-btn${category === c.id ? ' chip-accent' : ''}`} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {flash && <p className="flash-line">✓ {flash}</p>}

      {!searching && tab === 'repas' ? (
        <div className="food-list">
          {templates.length === 0 && <p className="muted">Aucun repas type. Dans un repas, « Enregistrer comme repas type ».</p>}
          {templates.map((t) => (
            <div key={t.id} className="food-row">
              <button
                className="food-main"
                onClick={async () => {
                  await addTemplate(t, props.day, meal);
                  showFlash(`${t.nom} ajouté`);
                }}
              >
                <b>{t.nom}</b>
                <small className="muted num">
                  {t.items.length} aliment{t.items.length > 1 ? "s" : ""} · {t.items.reduce((n, i) => n + i.kcal, 0)} kcal
                </small>
              </button>
              <button
                className="btn-ghost btn-danger"
                onClick={() => {
                  if (window.confirm(`Supprimer le repas type « ${t.nom} » ?`)) void deleteMealTemplate(t.id);
                }}
              >
                Suppr.
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="food-list">
          {list.length === 0 && (
            <p className="muted">
              {searching ? 'Aucun aliment trouvé.' : tab === 'recents' ? 'Tes aliments récents apparaîtront ici.' : tab === 'favoris' ? 'Touche ☆ sur un aliment pour l’ajouter aux favoris.' : 'Aucun aliment.'}
            </p>
          )}
          {list.slice(0, 80).map((f) => {
            const last = lastUse.get(f.key);
            const p = f.portions[0]!;
            const hint = last
              ? `${last.portion ? `${fmtN(last.portion.count)} × ${last.portion.label}` : `${last.grams} g`} · ${last.kcal} kcal`
              : `${p.label} · ${scale(f.pour100g, p.grams).kcal} kcal`;
            return (
              <div key={f.key} className="food-row">
                <button className="food-main" onClick={() => setView({ kind: 'quantity', food: f })}>
                  <b>
                    {f.nom}
                    {f.custom && <span className="chip" style={{ marginLeft: 6 }}>perso</span>}
                  </b>
                  <small className="muted num">{hint}</small>
                </button>
                <button className="add-btn" aria-label={`Ajouter ${f.nom}`} onClick={() => void quickAdd(f)}>
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="inputs">
        <button className="btn-secondary" onClick={() => setView({ kind: 'free' })}>
          Ajout libre
        </button>
        <button className="btn-secondary" onClick={() => setView({ kind: 'create' })}>
          Créer un aliment
        </button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Quantité (ajout ou modification)
// ---------------------------------------------------------------------------

export function QuantitySheet(props: {
  food: CatalogFood;
  meal: MealId;
  initial?: FoodEntry;
  favorite: boolean;
  editing?: boolean;
  onBack: () => void;
  onSave: (q: Quantity, meal: MealId) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { food } = props;
  const init = props.initial;
  const [meal, setMeal] = useState<MealId>(props.meal);
  const [mode, setMode] = useState<'portion' | 'grams'>(init?.portion || (!init && food.portions.length) ? 'portion' : 'grams');
  const [portionIdx, setPortionIdx] = useState(Math.max(0, food.portions.findIndex((p) => p.label === init?.portion?.label)));
  const [count, setCount] = useState(init?.portion?.count ?? 1);
  const [grams, setGrams] = useState<number | null>(init?.grams ?? food.portions[0]?.grams ?? 100);
  const [busy, setBusy] = useState(false);
  const fav = useLiveQuery(() => db.foodFavorites.get(food.key), [food.key]);

  const portion = food.portions[portionIdx] ?? food.portions[0];
  const q: Quantity =
    mode === 'portion' && portion ? { mode: 'portion', label: portion.label, grams: portion.grams, count } : { mode: 'grams', grams: grams ?? 0 };
  const values = scale(food.pour100g, quantityGrams(q));
  const valid = quantityGrams(q) > 0;

  return (
    <Sheet title={food.nom} onClose={props.onBack}>
      <div className="spread">
        <span className="muted num" style={{ fontSize: 14 }}>
          Pour 100 g : {food.pour100g.kcal} kcal · P {fmtN(food.pour100g.prot)} · G {fmtN(food.pour100g.gluc)} · L {fmtN(food.pour100g.lip)}
        </span>
        <button className="btn-ghost star" aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => void toggleFavorite(food.key)}>
          {fav ? '★' : '☆'}
        </button>
      </div>

      <Segmented
        ariaLabel="Repas"
        value={meal}
        onChange={setMeal}
        options={(Object.keys(MEAL_SHORT) as MealId[]).map((m) => ({ value: m, label: MEAL_SHORT[m] }))}
      />

      {food.portions.length > 0 && (
        <Segmented
          ariaLabel="Unité"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'portion', label: 'Portions' },
            { value: 'grams', label: 'Grammes' },
          ]}
        />
      )}

      {mode === 'portion' && portion ? (
        <>
          {food.portions.length > 1 && (
            <div className="chips">
              {food.portions.map((p, i) => (
                <button key={p.label} className={`chip chip-btn${i === portionIdx ? ' chip-accent' : ''}`} onClick={() => setPortionIdx(i)}>
                  {p.label} ({p.grams} g)
                </button>
              ))}
            </div>
          )}
          <Stepper label={`${portion.label} (${portion.grams} g)`} value={count} onChange={setCount} step={0.5} min={0.5} max={20} />
        </>
      ) : (
        <>
          <NumberField label="Quantité" value={grams} onChange={setGrams} unit="g" />
          <div className="chips">
            {nutritionConfig.quickGrams.map((g) => (
              <button key={g} className={`chip chip-btn${grams === g ? ' chip-accent' : ''}`} onClick={() => setGrams(g)}>
                {g} g
              </button>
            ))}
          </div>
        </>
      )}

      <div className="card macro-preview">
        <span className="big-number num">{values.kcal}</span>
        <span className="muted">kcal</span>
        <span className="num macro-line">
          P {fmtN(values.prot)} g · G {fmtN(values.gluc)} g · L {fmtN(values.lip)} g
        </span>
        <small className="faint num">{Math.round(quantityGrams(q))} g</small>
      </div>

      <button
        className="btn-primary"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          await props.onSave(q, meal);
        }}
      >
        {props.editing ? 'Enregistrer' : 'Ajouter'}
      </button>
      {props.onDelete && (
        <button className="btn-ghost btn-danger" onClick={() => void props.onDelete!()}>
          Supprimer cette saisie
        </button>
      )}
      {food.custom && !props.editing && (
        <button
          className="btn-ghost btn-danger"
          onClick={async () => {
            if (!window.confirm(`Retirer « ${food.nom} » de tes aliments ? Les saisies passées sont conservées.`)) return;
            await archiveCustomFood(food.source.type === 'perso' ? food.source.id : '');
            props.onBack();
          }}
        >
          Retirer de mes aliments
        </button>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Ajout libre et création d'aliment
// ---------------------------------------------------------------------------

export function FreeEntrySheet(props: {
  meal: MealId;
  initial?: FoodEntry;
  onBack: () => void;
  onSave: (e: Omit<FoodEntry, 'id' | 'createdAt' | 'day'>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const i = props.initial;
  const [meal, setMeal] = useState<MealId>(props.meal);
  const [nom, setNom] = useState(i?.nom ?? '');
  const [kcal, setKcal] = useState<number | null>(i?.kcal ?? null);
  const [prot, setProt] = useState<number | null>(i ? i.prot : null);
  const [gluc, setGluc] = useState<number | null>(i ? i.gluc : null);
  const [lip, setLip] = useState<number | null>(i ? i.lip : null);
  const valid = nom.trim().length > 0 && kcal !== null && kcal >= 0;

  return (
    <Sheet title={i ? 'Modifier la saisie' : 'Ajout libre'} onClose={props.onBack}>
      <Segmented
        ariaLabel="Repas"
        value={meal}
        onChange={setMeal}
        options={(Object.keys(MEAL_SHORT) as MealId[]).map((m) => ({ value: m, label: MEAL_SHORT[m] }))}
      />
      <label className="field">
        <span>Nom</span>
        <input type="text" value={nom} autoFocus={!i} placeholder="Ex. assiette du resto" onChange={(e) => setNom(e.target.value)} />
      </label>
      <NumberField label="Calories" value={kcal} onChange={setKcal} unit="kcal" />
      <p className="faint" style={{ fontSize: 13 }}>Macros optionnelles : renseigne au moins les protéines si tu les connais.</p>
      <div className="inputs">
        <NumberField label="Protéines" value={prot} onChange={setProt} unit="g" />
        <NumberField label="Glucides" value={gluc} onChange={setGluc} unit="g" />
        <NumberField label="Lipides" value={lip} onChange={setLip} unit="g" />
      </div>
      <button
        className="btn-primary"
        disabled={!valid}
        onClick={() =>
          void props.onSave({ meal, source: { type: 'libre' }, nom: nom.trim(), kcal: Math.round(kcal ?? 0), prot: prot ?? 0, gluc: gluc ?? 0, lip: lip ?? 0 })
        }
      >
        {i ? 'Enregistrer' : 'Ajouter'}
      </button>
      {props.onDelete && (
        <button className="btn-ghost btn-danger" onClick={() => void props.onDelete!()}>
          Supprimer cette saisie
        </button>
      )}
    </Sheet>
  );
}

function CreateFoodSheet(props: { onBack: () => void; onCreated: (food: CustomFood) => void }) {
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('plats');
  const [kcal, setKcal] = useState<number | null>(null);
  const [prot, setProt] = useState<number | null>(null);
  const [gluc, setGluc] = useState<number | null>(null);
  const [lip, setLip] = useState<number | null>(null);
  const [portionLabel, setPortionLabel] = useState('');
  const [portionGrams, setPortionGrams] = useState<number | null>(null);
  const valid = nom.trim().length > 0 && kcal !== null;

  return (
    <Sheet title="Créer un aliment" onClose={props.onBack}>
      <label className="field">
        <span>Nom</span>
        <input type="text" value={nom} autoFocus placeholder="Ex. wrap poulet maison" onChange={(e) => setNom(e.target.value)} />
      </label>
      <div className="chips">
        {aliments.categories.map((c) => (
          <button key={c.id} className={`chip chip-btn${categorie === c.id ? ' chip-accent' : ''}`} onClick={() => setCategorie(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Valeurs pour 100 g (sur l'étiquette)
      </p>
      <NumberField label="Calories" value={kcal} onChange={setKcal} unit="kcal" />
      <div className="inputs">
        <NumberField label="Protéines" value={prot} onChange={setProt} unit="g" />
        <NumberField label="Glucides" value={gluc} onChange={setGluc} unit="g" />
        <NumberField label="Lipides" value={lip} onChange={setLip} unit="g" />
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Portion type (optionnel)
      </p>
      <div className="inputs">
        <label className="field" style={{ flex: 2 }}>
          <span>Libellé</span>
          <input type="text" value={portionLabel} placeholder="1 wrap" onChange={(e) => setPortionLabel(e.target.value)} />
        </label>
        <NumberField label="Poids" value={portionGrams} onChange={setPortionGrams} unit="g" />
      </div>
      <button
        className="btn-primary"
        disabled={!valid}
        onClick={async () => {
          const food = {
            nom: nom.trim(),
            categorie,
            pour100g: { kcal: Math.round(kcal ?? 0), prot: prot ?? 0, gluc: gluc ?? 0, lip: lip ?? 0 },
            portions: portionLabel.trim() && portionGrams ? [{ label: portionLabel.trim(), grams: portionGrams }] : [{ label: '100 g', grams: 100 }],
          };
          const id = await saveCustomFood(food);
          props.onCreated({ ...food, id, createdAt: Date.now() });
        }}
      >
        Créer et ajouter
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Modification d'une saisie existante
// ---------------------------------------------------------------------------

export function EditEntrySheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const custom = useLiveQuery(() => db.customFoods.toArray(), []);
  if (!custom) return null;
  const key = sourceKey(entry.source);
  const food = key ? buildCatalog(custom.map((c) => ({ ...c, archived: false }))).find((f) => f.key === key) : undefined;
  const remove = async () => {
    await deleteEntry(entry.id);
    onClose();
  };

  if (!food) {
    return (
      <FreeEntrySheet
        meal={entry.meal}
        initial={entry}
        onBack={onClose}
        onDelete={remove}
        onSave={async (e) => {
          await updateEntry(entry.id, { ...e, source: entry.source });
          onClose();
        }}
      />
    );
  }
  return (
    <QuantitySheet
      food={food}
      meal={entry.meal}
      initial={entry}
      favorite={false}
      editing
      onBack={onClose}
      onDelete={remove}
      onSave={async (q, meal) => {
        await updateEntry(entry.id, { meal, ...entryValues(food, q), portion: q.mode === 'portion' ? { label: q.label, grams: q.grams, count: q.count } : undefined });
        onClose();
      }}
    />
  );
}

export { CATEGORY_LABELS };
