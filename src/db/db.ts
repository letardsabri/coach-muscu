/**
 * Base IndexedDB (Dexie).
 *
 * Règle de migration : ne JAMAIS modifier une version existante. Toute évolution du schéma
 * ajoute un nouveau `this.version(n + 1).stores(...)`, avec `.upgrade()` si des données
 * doivent être transformées. Seuls les champs indexés figurent dans les chaînes de schéma.
 */
import Dexie, { type EntityTable } from 'dexie';
import { nutritionConfig } from '../data/nutritionData';
import { defaultNutritionSettings } from '../engine/nutrition';
import type {
  BodyMetric,
  CustomFood,
  FoodEntry,
  FoodFavorite,
  MaxTest,
  MealTemplate,
  Meta,
  MmaSession,
  Photo,
  Profile,
  ProgramState,
  Recommendation,
  Reminder,
  ScheduleOverride,
  Session,
  SetLog,
} from './models';

export class CoachDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  programState!: EntityTable<ProgramState, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  foodEntries!: EntityTable<FoodEntry, 'id'>;
  customFoods!: EntityTable<CustomFood, 'id'>;
  mealTemplates!: EntityTable<MealTemplate, 'id'>;
  foodFavorites!: EntityTable<FoodFavorite, 'key'>;
  sets!: EntityTable<SetLog, 'id'>;
  maxTests!: EntityTable<MaxTest, 'id'>;
  bodyMetrics!: EntityTable<BodyMetric, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  mmaSessions!: EntityTable<MmaSession, 'id'>;
  scheduleOverrides!: EntityTable<ScheduleOverride, 'id'>;
  recommendations!: EntityTable<Recommendation, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name = 'coach-muscu') {
    super(name);

    this.version(1).stores({
      profile: 'id',
      programState: 'id',
      sessions: 'id, day, startedAt, status, type, [type+day]',
      sets: 'id, sessionId, exerciseId, completedAt, [exerciseId+completedAt]',
      maxTests: 'id, testId, day, [testId+day]',
      bodyMetrics: 'id, day',
      photos: 'id, day',
      mmaSessions: 'id, day',
      scheduleOverrides: 'id, day',
      recommendations: 'id, status, createdAt, exerciseId',
      reminders: 'id, kind',
      meta: 'key',
    });

    // v2 — Nutrition : 4 tables ajoutées, aucune table existante modifiée.
    // Le profil reçoit ses réglages nutrition par défaut (sexe non renseigné : jamais supposé).
    this.version(2)
      .stores({
        foodEntries: 'id, day, [day+meal], createdAt',
        customFoods: 'id, nom',
        mealTemplates: 'id',
        foodFavorites: 'key',
      })
      .upgrade((tx) =>
        tx
          .table('profile')
          .toCollection()
          .modify((p: Profile) => {
            if (!p.nutrition) p.nutrition = defaultNutritionSettings(nutritionConfig);
          }),
      );
  }
}

export const db = new CoachDB();

/**
 * Version du format d'export JSON (indépendante de la version Dexie).
 * v2 : tables nutrition ajoutées. Les sauvegardes v1 restent importables.
 */
export const BACKUP_FORMAT_VERSION = 2;
