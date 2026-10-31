/**
 * Faire sortir un fichier de l'app sur iPhone.
 *
 * En mode app (écran d'accueil), un lien de téléchargement classique est peu fiable sur iOS : on passe par
 * la feuille de partage (Web Share API niveau 2, iOS ≥ 15), qui propose « Enregistrer dans Fichiers »,
 * AirDrop, Mail, et pour un .ics l'ajout au Calendrier. Repli : téléchargement classique.
 */
export async function shareOrDownload(file: File, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Partage refusé (ex. type non accepté) : on tente le téléchargement.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
