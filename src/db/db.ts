/**
 * Base IndexedDB (Dexie).
 *
 * Règle de migration : ne JAMAIS modifier une version existante. Toute évolution du schéma
 * ajoute un nouveau `this.version(n + 1).stores(...)`, avec `.upgrade()` si des données
 * doivent être transformées. Seuls les champs indexés figurent dans les chaînes de schéma.
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMetric,
  MaxTest,
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
  }
}

export const db = new CoachDB();

/** Version du format d'export JSON (indépendante de la version Dexie). */
export const BACKUP_FORMAT_VERSION = 1;
