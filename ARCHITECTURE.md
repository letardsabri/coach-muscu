# ARCHITECTURE — Application de coaching musculation (PWA iPhone)

> Version 1.0 — 31/10/2026 · Étape 2 · Complète [PROGRAMME.md](PROGRAMME.md)

---

## 1. Principes directeurs

1. **Le programme est une donnée, pas du code.** Tout ce qui relève du coaching (exercices, variantes, fourchettes,
   seuils des règles R1–R8, critères de phase, budget MMA, rappels par défaut) vit dans
   [`src/data/programme.json`](src/data/programme.json). Le code l'interprète.
2. **Le moteur de coaching est pur.** Les règles de progression sont des fonctions sans effet de bord
   (`entrées → recommandation + explication`), testées unitairement. Aucune règle n'est cachée dans un composant React.
3. **Chaque action est sauvegardée immédiatement.** Valider une série écrit en base dans la foulée : fermer l'app,
   verrouiller l'écran ou perdre la batterie ne fait rien perdre.
4. **L'historique est figé.** Une séance enregistre une **copie du plan** au moment où elle commence. Modifier
   `programme.json` plus tard ne réécrit jamais le passé.
5. **Zéro serveur obligatoire.** Tout fonctionne hors ligne. Le seul service externe envisagé (notifications push) est
   **optionnel** et ne reçoit aucune donnée d'entraînement (§8).

---

## 2. Stack

| Besoin | Choix | Pourquoi |
|---|---|---|
| Build | **Vite 6** | Rapide, standard, sortie statique idéale pour GitHub Pages |
| UI | **React 19 + TypeScript** | TypeScript protège le modèle de données sur plusieurs années d'évolution |
| Base locale | **Dexie 4** (IndexedDB) + `dexie-react-hooks` | Requêtes indexées, migrations versionnées, `useLiveQuery` rend l'UI réactive à la base sans store global |
| Validation | **Zod** | Valide `programme.json` au démarrage **et** les fichiers de sauvegarde importés ; les types TS en sont déduits (une seule source) |
| Graphiques | **Chart.js 4** + `react-chartjs-2` | Rendu canvas, fluide sur mobile, importable par morceaux (~60 Ko gz utiles) |
| PWA | **vite-plugin-pwa** (Workbox) | Manifest + service worker générés, précache complet, mise à jour contrôlée |
| Styles | CSS natif + variables CSS | Pas de framework : thème sombre unique, poids minimal |
| Navigation | Routeur maison (~40 lignes, basé sur le hash) | 6 écrans seulement ; une dépendance de routage serait disproportionnée |
| Dates | `Intl` + utilitaires maison | Pas besoin de bibliothèque pour des dates locales jour/semaine |
| Tests | **Vitest** | Tests du moteur de règles et du schéma de données |

Dépendances d'exécution : **6** (react, react-dom, dexie, dexie-react-hooks, zod, chart.js + react-chartjs-2).

---

## 3. Arborescence

```
/
├─ PROGRAMME.md                 référence humaine du programme
├─ ARCHITECTURE.md              ce document
├─ index.html                   meta iOS (standalone, safe areas, theme-color)
├─ vite.config.ts               config Vite + PWA
├─ public/icons/                icônes (dont apple-touch-icon 180×180)
└─ src/
   ├─ main.tsx · App.tsx        point d'entrée, barre de navigation
   ├─ data/
   │  ├─ programme.json         ★ LE PROGRAMME (éditable sans toucher au code)
   │  ├─ programmeSchema.ts     schéma Zod + types déduits
   │  └─ programme.ts           chargement + validation au démarrage
   ├─ db/
   │  ├─ models.ts              types des enregistrements
   │  ├─ db.ts                  schéma Dexie + migrations
   │  └─ backup.ts              export / import JSON
   ├─ engine/                   ★ MOTEUR DE COACHING (fonctions pures, testées)
   │  ├─ planner.ts             construit la séance du jour (phase, deload, modes, forme du jour)
   │  ├─ progression.ts         R1, R2, R3 — par exercice
   │  ├─ fatigue.ts             R4, R6 — deload, séance allégée
   │  ├─ performance.ts         R5 — indice de performance (e1RM)
   │  ├─ phases.ts              R7 — critères de passage
   │  ├─ schedule.ts            R8, calendrier, alternance A/B, règle des 48 h
   │  ├─ mma.ts                 unités de charge, ajustements, placement
   │  └─ *.test.ts
   ├─ features/
   │  ├─ workout/               mode entraînement (priorité absolue)
   │  ├─ dashboard/
   │  ├─ progress/              graphiques de performance
   │  ├─ calendar/
   │  ├─ body/                  suivi corporel
   │  ├─ reminders/
   │  └─ settings/
   ├─ ui/                       composants génériques (Card, BigButton, Stepper, Sheet…)
   └─ lib/                      timer, wakeLock, sound, dates, ics
```

---

## 4. Modèle de données (IndexedDB via Dexie)

Détail complet et typé dans [`src/db/models.ts`](src/db/models.ts) et [`src/db/db.ts`](src/db/db.ts).

```
profile (1 ligne)          programState (1 ligne)
   │                          │ phase, bloc, cycle, prochaine séance,
   │                          │ variante + lest courant par exercice
   ▼                          ▼
sessions ──1:n──► sets     recommendations (journal des règles appliquées)
   │
   ├─ plan figé (snapshot)  maxTests        bodyMetrics      photos
   ├─ forme du jour         mmaSessions     scheduleOverrides
   └─ ressenti par exercice reminders       meta (version, dernière sauvegarde)
```

| Table | Clé · index | Contenu |
|---|---|---|
| `profile` | `id` = `"me"` | Nom, taille, objectif de poids, séances/semaine, jours préférés, mode cheville (+ date de guérison), mode MMA, haltères (min/max/palier), son |
| `programState` | `id` = `"current"` | Phase, bloc (F/H en phase 3), n° de cycle, date de début du cycle, prochaine séance (A/B), **état par exercice** (variante courante, lest/charge, choix d'alternative ex. rowing inversé), gel du lest |
| `sessions` | `id` · `startedAt`, `status`, `type` | Type (A, B, F, MIN, TEST), statut (en cours / terminée / abandonnée), phase/cycle/semaine, deload, forme du jour, ajustements appliqués, **plan figé**, curseur (exercice/série en cours), minuteur de repos (`restEndsAt`), poids du corps du jour, ressentis par exercice, douleurs signalées, notes |
| `sets` | `id` · `sessionId`, `exerciseId`, `[exerciseId+completedAt]` | Exercice, variante, n° de série, reps prévues/réalisées, charge externe (kg), négatives, horodatage |
| `maxTests` | `id` · `testId`, `date` | Test (tractions max, dips max, pompes max, tractions 3RM), valeur, charge, poids du corps |
| `bodyMetrics` | `id` · `date` | Poids, tour de taille, poitrine, bras, cuisse, hanches (tous optionnels) |
| `photos` | `id` · `date` | Image (Blob), angle — stockées localement |
| `mmaSessions` | `id` · `date` | Type (technique / intense), durée, note |
| `scheduleOverrides` | `id` · `date` | Décalage, annulation ou ajout d'une séance à une date |
| `recommendations` | `id` · `createdAt`, `status` | Règle (R1…R8), exercice, message expliqué, état (proposée / acceptée / ignorée) |
| `reminders` | `id` · `kind` | Type, activé, heure, jours, **message personnalisé** |
| `meta` | `key` | Version du schéma, date de dernière sauvegarde, programme.json utilisé |

**Choix importants**
- **Identifiants** : UUID (`crypto.randomUUID()`) → l'import d'une sauvegarde ne crée jamais de collision.
- **Dates** : instants en millisecondes (`number`), jours calendaires en `"YYYY-MM-DD"` (pas de piège de fuseau).
- **Charges** : on stocke la **charge externe** (lest ou haltère). Le poids du corps du jour est stocké dans la séance ;
  l'indice de performance (R5) se recalcule à tout moment.
- **Migrations** : chaque évolution du schéma = une nouvelle `db.version(n)` avec fonction d'upgrade. Les données
  existantes ne sont jamais perdues lors d'une mise à jour de l'app.

---

## 5. Le fichier programme

`src/data/programme.json` contient :

| Section | Rôle |
|---|---|
| `equipment` | Haltères (4–12 kg, palier 2 kg), lest (paliers 1,25 / 2,5 kg) |
| `exercises` | Pour chaque exercice : nom, consignes, muscles, type de charge, **impact cheville**, **échelle de variantes avec coefficients** |
| `phases` | Phases 1–3, chacune avec ses blocs (F/H en phase 3) et ses séances A et B : séries, fourchettes, RIR, repos, supersets, alternatives |
| `commonSessions` | Séance F (full body), séance minimale |
| `phaseCriteria` | Critères de passage chiffrés (§5 du programme) |
| `cycle`, `deload`, `rules` | Seuils de toutes les règles R1–R8 |
| `mma` | Unités de charge, budget, ajustements selon la fréquence |
| `tests`, `body`, `schedule`, `reminders` | Tests de max, repères corporels, planning par défaut, rappels par défaut |

Au démarrage, le fichier est **validé par Zod** : une faute de frappe (exercice inconnu, fourchette inversée) affiche
une erreur explicite au lieu d'un bug silencieux. Un test Vitest vérifie aussi le fichier avant chaque déploiement.

**Pour modifier le programme** : éditer le JSON → `npm run build` (ou simple `git push`, le déploiement est
automatique, étape 7). Ce qui est personnel et évolue au fil des séances (variante actuelle, lest, phase) est en base,
pas dans le JSON.

---

## 6. Moteur de coaching

```
                 programme.json ─┐
 profile + programState ─────────┤
 historique (sessions, sets) ────┼──► planner.ts ──► Plan de la séance du jour
 forme du jour (R6) ─────────────┤                   (exercices, séries, cibles, variante, charge)
 MMA récents ────────────────────┘

 Fin de séance ──► progression.ts (R1–R3) ─┐
                   performance.ts (R5)     ├──► recommendations (expliquées) ──► l'utilisateur accepte / ignore
                   fatigue.ts (R4)         │                                     └─► programState mis à jour
                   phases.ts (R7)  ────────┘
```

- **Le planner** applique dans l'ordre : phase/bloc → deload (semaine 6 ou anticipé) → mode cheville (exclusion /
  variante assise) → ajustements MMA → séance allégée (forme du jour) → reprise après pause (R8).
- **Les recommandations ne s'appliquent jamais en silence.** Chaque proposition affiche la règle, les chiffres qui la
  déclenchent et l'effet attendu, par exemple :
  > **R1 · Progression** — Tractions pronation : 4 × 6 atteint, ressenti « Correct ». Prochaine séance : tractions
  > **tempo**, objectif 4 × 3. *Pourquoi : tu as atteint le haut de la fourchette avec 2 reps en réserve.*
- Les règles sont implémentées une par fonction, avec en commentaire l'identifiant de la règle et la section de
  PROGRAMME.md correspondante.

---

## 7. Mode entraînement : choix techniques clés

| Exigence | Solution |
|---|---|
| Lancer en 1 tap | Bouton principal du tableau de bord → questionnaire de forme pré-rempli (1 tap pour confirmer) → séance |
| Valider une série en 1 geste | Gros bouton « Série validée » : reps et charge **pré-remplies** avec la cible ; correction par boutons −/+ uniquement si besoin |
| Ressenti | 4 boutons (Facile / Correct / Dur / Limite) **après la dernière série** de chaque exercice — 1 tap |
| Sauvegarde continue | Chaque action = écriture Dexie immédiate (série + curseur de séance) |
| Reprendre une séance | Au lancement, une séance `en cours` de moins de 12 h est proposée en reprise, au bon exercice/série |
| Chronomètre de repos fiable | On stocke `restEndsAt` (horodatage). L'affichage calcule `restEndsAt − Date.now()` à chaque image et à chaque retour au premier plan (`visibilitychange`). Écran verrouillé ou app en arrière-plan : le temps reste juste au retour |
| Écran allumé | **Screen Wake Lock API** (iOS ≥ 16.4 ; réacquis automatiquement au retour au premier plan, car iOS le libère) |
| Fin de repos | **Son** (Web Audio, débloqué au 1ᵉʳ tap de la séance ; `navigator.audioSession.type = "playback"` pour sonner même en mode silencieux) + **flash visuel** plein écran |
| Vibration | ⚠️ **Impossible** : Safari iOS n'implémente pas `navigator.vibrate`. Aucune app web ne peut faire vibrer un iPhone. |

**Limite honnête** : si l'écran est verrouillé **manuellement** pendant le repos, iOS suspend l'app : aucun son ne
peut être joué à la fin du repos (le minuteur reste juste au retour). Avec le Wake Lock actif, l'écran ne se verrouille
pas seul, donc le cas normal (téléphone posé à côté de la barre) fonctionne.

---

## 8. Rappels et alertes — décision technique

**Contrainte iOS** : une PWA fermée ne peut pas programmer de notification locale (l'API *Notification Triggers*
n'existe pas sur Safari). Pour recevoir une notification app fermée, il faut un **serveur** qui envoie un message
*Web Push* (pris en charge sur iPhone depuis iOS 16.4, uniquement pour une app installée sur l'écran d'accueil).

| Option | Serveur | Messages personnalisés | Dynamique (« séance B », « pas encore faite ») | Fiabilité | Mise en place |
|---|---|---|---|---|---|
| **A. Calendrier iPhone (.ics)** | Aucun | ✅ (texte de l'alerte) | ❌ texte figé à l'export ; à ré-exporter si le planning change | ✅ excellente (c'est le Calendrier d'iOS qui sonne) | Nulle |
| **B. Web Push via Cloudflare Worker** | Oui, gratuit (offre Workers gratuite : 100 000 requêtes/jour, tâches planifiées incluses) | ✅ | ✅ complet, y compris « séance non faite » | ✅ bonne | Créer un compte Cloudflare + 1 commande de déploiement (je fournis tout) |
| C. Raccourcis iOS (automatisation horaire) | Aucun | ✅ | ❌ | ✅ | Manuelle, réglée hors de l'app |

**Recommandation : A tout de suite, B en option à l'étape 6.**
- **A** est intégré dans l'app dès la première version : bouton « Ajouter au Calendrier » qui génère les rappels des
  8 prochaines semaines avec **tes messages** (variables résolues à l'export : `{seance}`, `{exercice1}`…).
- **B** ajoute les vrais rappels intelligents. Le Worker ne stocke **que** : ton abonnement push (identifiant technique),
  les horaires et les textes de rappel, et « séance faite aujourd'hui : oui/non ». **Aucune donnée d'entraînement ni
  corporelle ne quitte le téléphone.** Si le service tombe, l'app continue de fonctionner normalement.
- Dans l'app, les rappels se configurent dans un seul écran (type, heure, jours, message), quel que soit le canal.

---

## 9. Hors ligne et sécurité des données

- **Service worker** : précache de toute l'app (HTML, JS, CSS, icônes, programme). Après la 1ʳᵉ ouverture, plus
  aucune connexion n'est nécessaire.
- **Mise à jour** : nouvelle version détectée → bandeau « Mise à jour disponible » ; jamais de rechargement forcé
  pendant une séance.
- **Persistance** : appel à `navigator.storage.persist()`. Sur iOS, les apps **installées sur l'écran d'accueil**
  sont exemptées de l'effacement automatique des données après 7 jours d'inactivité qui touche les sites Safari.
- ⚠️ **Important** : sur iPhone, les données de l'app installée sont **séparées** de celles de Safari. Il faut
  **installer l'app d'abord** et n'utiliser que l'icône de l'écran d'accueil. Supprimer l'icône supprime les données.
- **Sauvegarde** : export JSON complet (option : avec ou sans photos) via la feuille de partage iOS → Fichiers /
  iCloud Drive. Rappel automatique si la dernière sauvegarde date de plus de 14 jours.
- **Import** : fichier validé par Zod, aperçu du contenu, puis remplacement **ou** fusion (grâce aux UUID).

---

### 9.1 Mis en œuvre (étape 6)

| Élément | Fichier | Détail |
|---|---|---|
| Format de sauvegarde | `src/db/backup.ts` | `{ format: "coach-muscu-backup", version, exportedAt, data: { <table>: [...] } }`, photos en base64 en option ; validé par Zod avant toute écriture |
| Sortie de fichier | `src/lib/files.ts` | Feuille de partage iOS (`navigator.share` avec fichier), repli téléchargement |
| Rappels | `src/features/reminders/reminders.ts` | Événements + alarme `.ics` (RFC 5545, heures flottantes, lignes pliées à 75 octets) sur 8 semaines |
| Mises à jour | `src/ui/UpdateBanner.tsx` | Bandeau « Nouvelle version », jamais pendant une séance |
| Icônes | `scripts/icons.mjs` | `node scripts/icons.mjs` régénère `public/icons/*` depuis un SVG (sharp, dépendance de dev) |
| Chargement | `src/App.tsx` | Écrans à graphiques chargés à la demande (Chart.js hors du démarrage), tous précachés |

**Option B (notifications push) non mise en place** : elle demande un compte Cloudflare et un petit serveur ; à
décider après le déploiement, si les rappels Calendrier ne suffisent pas.

## 10. Interface

Barre de navigation inférieure (5 onglets, cibles ≥ 56 px, au-dessus de `env(safe-area-inset-bottom)`) :

| Onglet | Contenu |
|---|---|
| **Accueil** | Prochaine séance + gros bouton « Commencer », semaine en cours, poids (moyenne 7 j) vs objectif, recommandations en attente, dernières performances |
| **Progrès** | Max tractions / dips / pompes, indice de force (e1RM), curl, volume hebdomadaire par muscle |
| **Calendrier** | Semaine/mois, alternance A/B, repos, MMA, décaler/ajouter |
| **Corps** | Saisie rapide poids/mensurations, courbes, historique, photos |
| **Réglages** | Profil, objectif, séances/semaine, mode cheville, mode MMA, rappels, sauvegarde |

Le **mode entraînement** est un écran plein écran hors onglets (pas de navigation accidentelle pendant une séance).

Thème : fond `#0B0B0C`, cartes `#161618`, texte `#F5F5F7`, accent **orange `#FF5A1F`**, succès vert sobre. Police
système (SF Pro sur iPhone) avec chiffres tabulaires pour les compteurs.

---

## 11. Plan des étapes suivantes

| Étape | Livrable |
|---|---|
| 3 | Mode entraînement complet (planner de base, séance A/B, séries, minuteur, wake lock, reprise) |
| 4 | Tableau de bord, graphiques, calendrier, suivi corporel |
| 5 | Moteur de progression R1–R8 + tests |
| 6 | Export/import, hors ligne, rappels (.ics + option push), finitions design |
| 7 | Déploiement GitHub Pages + installation sur l'iPhone |

### Prérequis sur ton PC
**Node.js** (LTS) et **Git** ne sont pas installés sur cette machine. Ils sont nécessaires pour compiler l'app (étape 3)
et la déployer (étape 7). Installation possible par `winget` (outil officiel de Windows), avec ton accord.
