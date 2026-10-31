# DÉPLOIEMENT — Mettre l'app en ligne et l'installer sur l'iPhone

> Étape 7 · Hébergement gratuit sur **GitHub Pages** (HTTPS inclus, obligatoire pour une PWA).

---

## Ce qui se passe, en une phrase

Le code est envoyé sur GitHub ; à chaque envoi, GitHub lance les tests, construit l'app et la publie à une adresse
du type `https://<ton-pseudo>.github.io/coach-muscu/`. Ton iPhone l'installe depuis Safari, puis elle fonctionne
hors ligne.

**Tes données d'entraînement ne vont jamais sur GitHub** : elles restent dans le téléphone. Seul le code est publié.

---

## 1. Créer ton compte GitHub (toi, ~3 min)

1. Va sur **https://github.com/signup** et crée un compte (gratuit).
2. Choisis ton **pseudo** avec soin : il apparaîtra dans l'adresse de l'app (`https://<pseudo>.github.io/...`).
3. Valide ton adresse e-mail.
4. Conseillé : active la double authentification (Settings → Password and authentication).
5. Conseillé : coche **Keep my email addresses private** (Settings → Emails). GitHub te donne une adresse
   `…@users.noreply.github.com` à utiliser pour les commits, ce qui évite de publier ton e-mail.

## 2. Créer le dépôt (toi, ~1 min)

1. En haut à droite : **+ → New repository**.
2. Nom : **`coach-muscu`**.
3. Visibilité : **Public**. GitHub Pages gratuit exige un dépôt public ; seul le code est visible, pas tes données.
4. **Ne coche rien** (pas de README, pas de .gitignore, pas de licence) : le projet en contient déjà.
5. **Create repository**.

## 3. Activer GitHub Pages (toi, ~30 s)

Dans le dépôt : **Settings → Pages → Build and deployment → Source : `GitHub Actions`**.

## 4. Premier envoi du code

Je m'en occupe depuis ton PC, dans le dossier du projet :

```bash
git init -b main
git add .
git commit -m "Coach Muscu : première version"
git remote add origin https://github.com/<pseudo>/coach-muscu.git
git push -u origin main
```

Au premier `git push`, **une fenêtre de connexion GitHub s'ouvre dans ton navigateur** (Git Credential Manager) :
c'est **toi** qui te connectes. Ensuite les envois suivants se font sans redemander.

## 5. Suivre la publication

Onglet **Actions** du dépôt : le déploiement prend ~1 à 2 min (tests → construction → publication).
Une coche verte = en ligne à l'adresse **`https://<pseudo>.github.io/coach-muscu/`**.
Une croix rouge = un test a échoué : rien n'est publié, l'ancienne version reste en ligne.

---

## 6. Installer l'app sur l'iPhone

1. Ouvre **Safari** (obligatoire : Chrome ou un autre navigateur sur iPhone ne permettent pas l'installation complète).
2. Va à l'adresse `https://<pseudo>.github.io/coach-muscu/`.
3. Touche le bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → vérifie le nom « Coach »
   et que **« Ouvrir comme app web »** est activé → **Ajouter**.
4. Ouvre l'app **depuis l'icône** de l'écran d'accueil, avec une connexion la première fois (elle se met en cache).

### ⚠️ Trois règles importantes
- **Utilise uniquement l'icône**, pas l'onglet Safari : sur iPhone, l'app installée a ses propres données, séparées de
  Safari. Ce que tu saisis dans Safari n'apparaît pas dans l'app, et inversement.
- **Supprimer l'icône supprime les données.** Exporte une sauvegarde avant (Réglages → Sauvegarde).
- **Sauvegarde toutes les 2 semaines** dans Fichiers → iCloud Drive (l'app te le rappelle).

---

## 7. Mettre à jour l'app plus tard

- Je modifie le code puis `git push` → GitHub republie automatiquement.
- Sur l'iPhone, à la prochaine ouverture, un bandeau **« Nouvelle version disponible »** apparaît (jamais pendant
  une séance) → **Mettre à jour**. Tes données sont conservées.
- **Modifier le programme sans toucher au code** : `src/data/programme.json` (exercices, séries, fourchettes,
  seuils des règles). Les tests vérifient le fichier à chaque envoi : une erreur bloque la publication au lieu de
  casser l'app.

---

## 8. À tester sur ton iPhone (ce que l'émulation ne peut pas vérifier)

Coche au fur et à mesure :

**Installation et affichage**
- [ ] L'icône (barre + chevron orange) apparaît sur l'écran d'accueil, nom « Coach ».
- [ ] L'app s'ouvre en plein écran, sans barre Safari.
- [ ] Rien n'est caché sous l'encoche / Dynamic Island ni sous la barre d'accueil en bas.

**Hors ligne**
- [ ] Mode Avion activé → l'app s'ouvre quand même, tous les onglets fonctionnent.

**Séance (le plus important)**
- [ ] Pendant une séance, l'écran **ne se met pas en veille** (attendre 2–3 min sans toucher).
- [ ] **Son** de fin de repos audible, y compris **avec le bouton silencieux activé**.
- [ ] Verrouiller l'iPhone pendant un repos, attendre, déverrouiller → le chrono est juste.
- [ ] Fermer complètement l'app (balayer vers le haut) en pleine séance, la rouvrir → reprise à la bonne série.
- [ ] Chrono de maintien (L-sit, gainage) : démarrer, arrêter, la durée se remplit.

**Rappels**
- [ ] Réglages → Rappels → Exporter → « Enregistrer dans Fichiers » → ouvrir le fichier dans Fichiers →
      **Tout ajouter** au Calendrier → les alarmes sonnent à l'heure avec ton message.

**Sauvegarde**
- [ ] Exporter une sauvegarde → elle apparaît dans Fichiers / iCloud Drive.
- [ ] Réglages → Sauvegarde → « Stockage protégé » : noter ce qui s'affiche.

**Photos**
- [ ] Corps → Ajouter une photo → l'appareil photo et la photothèque sont proposés.

Si un point ne fonctionne pas, dis-moi lequel et ce qui se passe : je corrige et je republie.
