/**
 * Sauvegarde : export JSON vers Fichiers / iCloud Drive, import avec aperçu, état du stockage.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { backupFileName, exportBackup, importBackup, markBackupDone, parseBackup, summarize, type Backup } from '../../db/backup';
import { db } from '../../db/db';
import { ensureInitialized } from '../../db/init';
import { shareOrDownload } from '../../lib/files';
import { Toggle } from '../../ui/components';

export function BackupPanel() {
  const last = useLiveQuery(() => db.meta.get('lastBackupAt'), []);
  const [withPhotos, setWithPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup(withPhotos);
      const file = new File([JSON.stringify(backup)], backupFileName(), { type: 'application/json' });
      const result = await shareOrDownload(file, 'Sauvegarde Coach Muscu');
      if (result !== 'cancelled') {
        await markBackupDone();
        const s = summarize(backup);
        setMessage({ tone: 'ok', text: `Sauvegarde créée : ${s.sessions} séances, ${s.bodyMetrics} mesures${s.photos ? `, ${s.photos} photos` : ''}.` });
      }
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) setMessage({ tone: 'warn', text: parsed.error });
    else {
      setPending(parsed.backup);
      setMessage(null);
    }
  };

  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    if (mode === 'replace' && !window.confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
    setBusy(true);
    try {
      await importBackup(pending, mode);
      await ensureInitialized();
      setMessage({ tone: 'ok', text: mode === 'replace' ? 'Données restaurées.' : 'Sauvegarde fusionnée avec les données actuelles.' });
      setPending(null);
    } catch (e) {
      setMessage({ tone: 'warn', text: `Échec de l'import : ${e instanceof Error ? e.message : String(e)}. Aucune donnée n'a été modifiée.` });
    } finally {
      setBusy(false);
    }
  };

  const lastText = typeof last?.value === 'number' ? new Date(last.value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'jamais';
  const summary = pending ? summarize(pending) : null;

  return (
    <>
      <section className="card">
        <h3 className="card-h">Exporter</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Dernière sauvegarde : <b>{lastText}</b>. Enregistre le fichier dans Fichiers → iCloud Drive : il survit à la perte ou au
          changement de téléphone.
        </p>
        <Toggle label="Inclure les photos" hint="Fichier beaucoup plus lourd" checked={withPhotos} onChange={setWithPhotos} />
        <button className="btn-primary" disabled={busy} onClick={() => void doExport()}>
          Exporter la sauvegarde
        </button>
      </section>

      <section className="card">
        <h3 className="card-h">Restaurer</h3>
        <label className="btn-secondary file-btn">
          Choisir un fichier de sauvegarde
          <input type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {summary && (
          <>
            <p className="muted" style={{ fontSize: 14 }}>
              Sauvegarde du {new Date(summary.exportedAt).toLocaleDateString('fr-FR')} : {summary.sessions} séances, {summary.sets} séries,{' '}
              {summary.bodyMetrics} mesures, {summary.maxTests} tests, {summary.foodEntries} saisies alimentaires{summary.photos ? `, ${summary.photos} photos` : ''}.
            </p>
            <div className="inputs">
              <button className="btn-secondary" disabled={busy} onClick={() => void doImport('merge')}>
                Fusionner
              </button>
              <button className="btn-secondary btn-danger" disabled={busy} onClick={() => void doImport('replace')}>
                Remplacer
              </button>
            </div>
            <p className="faint" style={{ fontSize: 13 }}>
              Fusionner : ajoute ce qui manque, sans rien supprimer. Remplacer : l'app revient exactement à l'état de la sauvegarde.
            </p>
          </>
        )}
      </section>

      {message && (
        <p style={{ fontSize: 14, color: message.tone === 'ok' ? 'var(--ok)' : 'var(--warn)' }} role="status">
          {message.text}
        </p>
      )}

      <section className="card">
        <h3 className="card-h">Stockage</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Tes données sont uniquement sur ce téléphone (aucun serveur). Stockage protégé contre l'effacement automatique :{' '}
          <b>{persisted === null ? 'inconnu' : persisted ? 'oui' : 'non'}</b>. Sur iPhone, l'app installée sur l'écran d'accueil est
          protégée ; supprimer son icône supprime ses données.
        </p>
      </section>

      <section className="card">
        <h3 className="card-h">Zone sensible</h3>
        <button
          className="btn-secondary btn-danger"
          onClick={async () => {
            if (!window.confirm('Effacer TOUTES les données de l’app ?')) return;
            if (!window.confirm('Vraiment ? Cette action est définitive. Exporte une sauvegarde avant si besoin.')) return;
            await db.delete();
            location.reload();
          }}
        >
          Effacer toutes les données
        </button>
      </section>
    </>
  );
}
