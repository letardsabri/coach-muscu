# PROGRAMME — Musculation au poids du corps, orientée hypertrophie haut du corps

> Version 1.2 — 31/10/2026 · ajout d'un bloc abdos dans toutes les séances (§5.7)
> Profil de départ : 22 ans · 1,79 m · 86 kg → **objectif 78 kg** · tractions 5–8 · dips 10–15 · MMA en pause · cheville blessée
> Matériel : barre de traction, barres de dips (hauteur standard), haltères réglables **4–12 kg** (paliers de 2 kg supposés :
> 4 · 6 · 8 · 10 · 12), une chaise, un sac à dos. Disponible **tous les jours** (entraînement à la maison).

Ce document est la **source de vérité** du programme. L'application en sera une traduction fidèle : chaque
séance, chaque fourchette de répétitions et chaque règle de progression ci-dessous sera encodée dans un fichier de
données séparé (`programme.json`), modifiable sans toucher au code.

---

## 0. Résumé en 30 secondes

- **2 séances qui alternent** : **A = Tirage** (dos, biceps, arrière d'épaule) / **B = Poussée** (pecs, triceps, épaules).
  Chacune se termine par un **bloc abdos** (§5.7).
- **3 séances/semaine** au départ (A-B-A puis B-A-B), **4** possibles à partir de la phase 2. **~30 min** par séance
  (le complément jambes, optionnel, ajoute ~3 min).
- **Double progression** : on monte les répétitions dans une fourchette ; quand le haut de la fourchette est atteint sur
  toutes les séries, on **augmente la difficulté** (variante plus dure, lest, tempo) et on repart du bas de la fourchette.
- **Intensité pilotée par le RIR** (répétitions en réserve), jamais « à l'échec à chaque série ».
- **Cycles de 6 semaines** : 5 semaines de progression + 1 semaine de **décharge (deload) avec tests de max**.
- **4 phases** avec des **critères de passage chiffrés**. La phase 4 (MMA) est une **surcouche** applicable dès la reprise.
- **Mode cheville** : aucun exercice debout chargé, aucun saut, montée/descente de la barre par une chaise.

---

## 1. Les principes qui justifient tout le reste

### 1.1 Ce qui fait grossir un muscle
1. **Tension mécanique proche de l'échec** : une série est « efficace » pour l'hypertrophie si elle se termine à
   0–3 répétitions de l'échec. Entre ~5 et ~30 répétitions, la croissance est comparable **à proximité d'échec égale**.
2. **Volume hebdomadaire** : ~10 à 20 séries efficaces par groupe musculaire et par semaine. En dessous de 10, on
   progresse plus lentement ; au-dessus de 20, la récupération devient le facteur limitant (surtout avec du MMA).
3. **Fréquence** : travailler chaque muscle **≥ 2 fois par semaine** (en moyenne 1,5 en semaine à 3 séances, 2 à 4).
4. **Surcharge progressive** : faire *un peu plus* dans le temps (reps, charge, difficulté), à technique identique.

### 1.2 Pourquoi « plus de répétitions » n'est pas toujours mieux
Au-delà de ~20–25 répétitions, une série de pompes devient surtout un travail d'endurance : l'effort cardio-respiratoire
et la brûlure locale arrivent avant la vraie fatigue mécanique des fibres. Pour continuer à grossir et à gagner en
force, il faut **augmenter la difficulté par répétition** plutôt que le nombre de répétitions. D'où :

- des **plafonds de répétitions** pour chaque exercice (ex. pompes : 20 maximum avant de passer à une variante plus dure) ;
- des **échelles de variantes** (§6) et le **lest** (sac à dos) quand le poids du corps devient trop facile.

L'endurance musculaire n'est pas oubliée : elle est travaillée par les séries hautes en répétitions des exercices
d'isolation, par le temps de repos contrôlé et, plus tard, par le MMA lui-même.

### 1.3 Le RIR : la seule mesure d'effort utilisée
**RIR = Reps In Reserve** = combien de répétitions propres tu aurais encore pu faire à la fin de la série.

| Ressenti (bouton dans l'app) | RIR | RPE équivalent |
|---|---|---|
| **Facile** | 3 ou plus | ≤ 7 |
| **Correct** | 2 | 8 |
| **Dur** | 1 | 9 |
| **Limite** (échec ou presque) | 0 | 10 |

Règle d'or : **les exercices polyarticulaires (tractions, dips) ne vont jamais à l'échec technique**, surtout lestés.
L'échec est réservé, ponctuellement, à la **dernière série des exercices d'isolation** (curl, élévations latérales).

### 1.4 Perte de poids : être honnête
Une séance de 25 min dépense ~150–250 kcal. **La musculation ne fait pas maigrir à elle seule** : elle sert à
**garder et construire du muscle pendant que l'alimentation crée le déficit**. Voir §12 pour le minimum nutritionnel.
Un bonus utile : perdre du poids **améliore mécaniquement** les tractions et les dips (moins de charge à déplacer).

---

## 2. Standards d'exécution (une répétition ne compte que si elle les respecte)

Des standards fixes rendent les chiffres **comparables d'une année à l'autre**. Sans eux, les graphiques mentent.

| Exercice | Départ | Arrivée | Interdit |
|---|---|---|---|
| **Traction pronation** (paumes vers l'avant, prise ~largeur d'épaules + 1 main) | Bras **complètement tendus**, épaules engagées | **Menton au-dessus de la barre** | Élan, battement de jambes, demi-amplitude |
| **Traction supination** (paumes vers soi, prise largeur d'épaules) | Bras tendus | Menton au-dessus de la barre | Idem |
| **Dips** | Bras tendus verrouillés | **Épaule au niveau ou sous le coude** (≥ 90° au coude), puis remontée complète | Rebond en bas, haussement d'épaules |
| **Pompe** | Bras tendus, corps gainé en planche | **Poitrine à ~1 poing du sol** | Bassin qui s'affaisse, tête qui plonge |
| **Curl haltères** | Bras tendus | Contraction complète | Balancement du buste |
| **Élévation latérale** | Bras le long du corps | Coudes à hauteur d'épaules | Élan, haussement de trapèzes |

**Tempo** par défaut : **descente contrôlée en 2 s**, montée dynamique mais contrôlée. Un tempo plus lent est une
*variante* à part entière (on l'enregistre comme telle).

---

## 3. Protocole cheville blessée (mode « cheville » dans l'app)

Objectif : **zéro charge sur la cheville**, sans sacrifier le haut du corps.

| Situation | Adaptation |
|---|---|
| Monter / descendre de la barre de traction | **Toujours via une chaise**, avec la jambe saine. **Jamais de saut ni de chute** depuis la barre. |
| Barres de dips | Monter et descendre avec la chaise, ou en poussant des bras depuis le sol sans impulsion de jambes. |
| Pompes | Position pointe de pieds **indolore (confirmé)** → pompes normales. Solution de repli si la douleur apparaît : **dessus des pieds posés à plat sur un coussin**, puis pompes **sur les genoux** avec descente lente (3 s) — on enregistre la variante. |
| Curl, élévations, oiseau, extension triceps | **Assis** sur une chaise, pieds posés à plat. |
| Jambes | Module jambes désactivé. Seul le **pont fessier unilatéral au sol** est proposé, *uniquement s'il est indolore*. |
| Cardio | Pas de course, pas de saut, pas de shadow boxing debout. |

Le mode cheville se désactive dans les paramètres. Les exercices portent un attribut `cheville` (`aucune`, `faible`,
`forte`) : en mode cheville, les exercices `forte` sont **exclus** et les exercices `faible` passent en **variante assise
ou adaptée**.

> ⚠️ Je ne remplace pas un professionnel de santé. Si la douleur persiste plus de 2–3 semaines, si la cheville
> « lâche » ou gonfle, consulte un kinésithérapeute : une entorse mal rééduquée récidive souvent, ce qui compte
> beaucoup pour le MMA.

---

## 4. Échauffement (3–4 min, toujours le même)

1. Cercles de bras et rotations d'épaules — 30 s
2. **Tractions scapulaires** (suspendu, bras tendus, abaisser/remonter les omoplates) — 8 reps *(séance A)*
   ou **pompes scapulaires** — 10 reps *(séance B)*
3. Rotations externes d'épaule, coude au corps, **sans charge** (main fermée, tension volontaire) ou haltère de 4 kg si
   c'est facile — 10 reps / bras
4. **1 série d'approche** du premier exercice à ~50 % (ex. 2–3 tractions faciles, 4–5 dips faciles) — ne compte pas.

---

## 5. Les phases

Toutes les phases suivent le même **cycle de 6 semaines** :

```
Semaines 1 à 5 : progression (double progression, §7)
Semaine 6      : décharge (deload, §8) + tests de max (§11)
```

### PHASE 1 — Adaptation et bases (1 cycle : 6 semaines, extensible à 2 cycles)

**But** : installer la technique stricte, renforcer tendons et coudes (les tractions/dips fréquents irritent vite
les coudes chez un pratiquant qui progresse trop vite), établir les valeurs de référence.
**Intensité** : RIR **2–3** sur tout. Aucun échec. **Fréquence** : 3 séances/semaine.

#### Séance A1 — Tirage (≈ 31 min, ≈ 28 sans le complément jambes)

| # | Exercice | Séries | Reps | RIR | Repos |
|---|---|---|---|---|---|
| 1 | Tractions pronation | 4 | **3–6** | 2–3 | 2 min |
| 2 | Tractions supination | 3 | **4–8** | 2–3 | 2 min |
| 3a | Curl haltères assis (alterné ou simultané) | 3 | **10–15** | 2 | enchaîner 3b |
| 3b | Oiseau assis buste penché (deltoïde postérieur) | 3 | **12–20** | 2 | 60 s |
| 4a | **Abdos** — Relevés suspendus (§5.7) | 2 | **8–15** | 2 | enchaîner 4b |
| 4b | **Abdos** — Gainage latéral | 2 | **20–45 s / côté** | 2 | 45 s |
| 5 | Complément jambes (§5.5) — *optionnel* | 2 | voir §5.5 | 2 | 60 s |

**Si une série de tractions tombe sous le minimum** (ex. 2 reps au lieu de 3) : compléter **immédiatement** avec des
**négatives** (monter via la chaise, descendre en 4 s) jusqu'au minimum. L'app enregistre « 2 + 1 nég. ».

#### Séance B1 — Poussée (≈ 31 min, ≈ 28 sans le complément jambes)

| # | Exercice | Séries | Reps | RIR | Repos |
|---|---|---|---|---|---|
| 1 | Dips | 4 | **6–10** | 2–3 | 2 min |
| 2 | Pompes (variante selon niveau, §6) | 3 | **10–20** | 2 | 90 s |
| 3a | Élévations latérales assis | 3 | **12–20** | 2 | enchaîner 3b |
| 3b | Extension triceps nuque assis (1 haltère, 2 mains) | 2 | **10–15** | 2 | 60 s |
| 4a | **Abdos** — L-sit aux barres de dips (§5.7) | 2 | **10–30 s** | 2 | enchaîner 4b |
| 4b | **Abdos** — Crunch lesté au sol | 2 | **10–20** | 2 | 45 s |
| 5 | Complément jambes (§5.5) — *optionnel* | 2 | voir §5.5 | 2 | 60 s |

#### Volume hebdomadaire phase 1 (séries directes, 3 séances/sem → 1,5 A + 1,5 B en moyenne)

| Groupe | Séries/sem |
|---|---|
| Dos (grand dorsal) | ~10,5 |
| Pectoraux | ~10,5 (dips + pompes) |
| Triceps | ~3 directes + ~10 indirectes |
| Biceps | ~4,5 directes + ~4,5 indirectes (supination) |
| Deltoïde latéral | ~4,5 |
| Deltoïde postérieur | ~4,5 (+ indirect tractions) |
| **Abdominaux / obliques** | **~12** (4 par séance) |

Volume volontairement modéré : la phase 1 doit laisser de la marge pour que la progression soit rapide et propre.

#### ✅ Critères de passage Phase 1 → Phase 2 (tous requis)
1. **≥ 5 semaines** effectuées en phase 1 (un cycle complet, deload inclus = 6).
2. **Assiduité ≥ 80 %** des séances prévues sur les 4 dernières semaines.
3. **Au moins 2 des 3 performances** au test de max (§11) :
   - Tractions pronation strictes **≥ 8**
   - Dips stricts **≥ 15**
   - Pompes strictes **≥ 25**
4. **Aucune douleur articulaire** (coude, épaule) ≥ 3/10 pendant les 2 dernières semaines.

Si les critères ne sont pas remplis après 2 cycles (12 semaines) **mais que les performances progressent**, on passe
quand même en phase 2 : elle convient aussi. Si elles **ne progressent pas**, l'app signale un problème de
récupération (sommeil, déficit calorique trop agressif) plutôt que d'ajouter du volume.

---

### PHASE 2 — Développement musculaire et performances (2 à 3 cycles : 12–18 semaines)

**But** : le gros de la prise de muscle. Volume plus élevé, intensité plus proche de l'échec.
**Intensité** : RIR **1–2** sur les polyarticulaires, **0–1 sur la dernière série d'isolation**.
**Fréquence** : 3 ou **4** séances/semaine (A-B-repos-A-B-repos-repos).

#### Séance A2 — Tirage (≈ 33 min, ≈ 30 sans le complément jambes)

| # | Exercice | Séries | Reps | RIR | Repos |
|---|---|---|---|---|---|
| 1 | Tractions pronation | 4 | **5–8** | 1–2 | 2 min 30 |
| 2 | Tractions supination | 3 | **6–10** | 1–2 | 2 min |
| 3a | Curl haltères (variante §6) | 3 | **10–15** | 1 → 0 dernière série | enchaîner |
| 3b | Oiseau assis **ou** rowing inversé sous les barres de dips (§5.6) | 3 | **12–20** / **8–15** | 1 | enchaîner |
| 3c | Élévations latérales assis | 2 | **12–20** | 1 | 60 s |
| 4a | **Abdos** — Relevés suspendus | 3 | **8–15** | 1–2 | enchaîner 4b |
| 4b | **Abdos** — Gainage latéral | 2 | **20–45 s / côté** | 1–2 | 45 s |
| 5 | Complément jambes (§5.5) — *optionnel* | 2 | voir §5.5 | 1–2 | 60 s |

#### Séance B2 — Poussée (≈ 33 min, ≈ 30 sans le complément jambes)

| # | Exercice | Séries | Reps | RIR | Repos |
|---|---|---|---|---|---|
| 1 | Dips | 4 | **8–12** | 1–2 | 2 min 30 |
| 2 | Pompes (variante plus dure, §6) | 3 | **8–15** | 1–2 | 90 s |
| 3a | Élévations latérales assis | 3 | **12–20** | 1 → 0 dernière série | enchaîner |
| 3b | Extension triceps nuque | 3 | **10–15** | 1 | 60 s |
| 4a | **Abdos** — L-sit aux barres | 3 | **10–30 s** | 1–2 | enchaîner 4b |
| 4b | **Abdos** — Crunch lesté | 2 | **10–20** | 1 | 45 s |
| 5 | Complément jambes (§5.5) — *optionnel* | 2 | voir §5.5 | 1–2 | 60 s |

**Épaules prioritaires** : le deltoïde latéral passe à ~7–10 séries/sem (il récupère vite, coût de fatigue faible).

#### Volume hebdomadaire phase 2

| Groupe | 3 séances/sem | 4 séances/sem |
|---|---|---|
| Dos | ~10,5 | ~14 |
| Pectoraux | ~10,5 | ~14 |
| Deltoïde latéral | ~7,5 | ~10 |
| Biceps (direct) | ~4,5 | ~6 |
| Triceps (direct) | ~4,5 | ~6 |
| Deltoïde postérieur | ~4,5 | ~6 |
| **Abdominaux / obliques** | ~15 | ~20 |

#### ✅ Critères de passage Phase 2 → Phase 3 (tous requis)
1. **≥ 2 cycles** (12 semaines) en phase 2.
2. Tractions pronation : **4 × 8** atteint en séance (haut de fourchette) **ou** max ≥ **12**.
3. Dips : **4 × 12** atteint **ou** max ≥ **20**.
4. Aucune douleur articulaire ≥ 3/10 sur les 2 dernières semaines.

Justification : le lest n'a de sens que lorsque le poids du corps permet ~10–12 répétitions strictes. En dessous,
le lest dégrade la technique et sollicite trop les coudes.

---

### PHASE 3 — Difficulté accrue : lest et variantes avancées (illimitée, des années)

**But** : continuer à progresser alors que le poids du corps ne suffit plus. Alternance de **blocs de 6 semaines** :

| Bloc | Objectif | Tractions / Dips | Isolation |
|---|---|---|---|
| **F — Force** | Force relative, tension maximale | **Lestés**, 4 × **4–6**, RIR 1–2, repos 3 min | 2–3 séries, RIR 1 |
| **H — Hypertrophie** | Volume, croissance | Lest léger ou variante dure, 4 × **6–10**, RIR 1, repos 2 min | 3 séries, RIR 0–1 |

On alterne **F → H → F → H…**, chaque bloc se terminant par une semaine de deload + tests.

#### Séance A3 (bloc F) — ≈ 30 min

| # | Exercice | Séries | Reps | RIR | Repos |
|---|---|---|---|---|---|
| 1 | Tractions pronation **lestées** | 4 | **4–6** | 1–2 | 3 min |
| 2 | Tractions supination (poids du corps) | 2 | **8–12** | 1 | 2 min |
| 3a | Curl haltères (variante) | 3 | **8–12** | 0–1 | enchaîner |
| 3b | Oiseau / élévations latérales | 3 | **12–20** | 1 | 60 s |
| 4a | **Abdos** — Relevés suspendus | 3 | **8–15** | 1 | enchaîner 4b |
| 4b | **Abdos** — Gainage latéral | 2 | **20–45 s / côté** | 1 | 45 s |

#### Séance B3 (bloc F) — ≈ 33 min

| # | Exercice | Séries | Reps | RIR | Repos |
|---|---|---|---|---|---|
| 1 | Dips **lestés** | 4 | **5–8** | 1–2 | 3 min |
| 2 | Pompes avancées (archer, pseudo-planche, lestées) | 3 | **6–12** | 1 | 90 s |
| 3a | Élévations latérales | 3 | **12–20** | 0–1 | enchaîner |
| 3b | Extension triceps nuque | 2 | **10–15** | 1 | 60 s |
| 4a | **Abdos** — L-sit aux barres | 3 | **10–30 s** | 1 | enchaîner 4b |
| 4b | **Abdos** — Crunch lesté | 2 | **10–20** | 1 | 45 s |
| 5 | Complément jambes — *optionnel* | 2 | voir §5.5 | 1 | 60 s |

Le bloc H reprend la structure de la phase 2 (abdos compris) avec les variantes les plus dures maîtrisées.

**Lest** : sac à dos avec bouteilles d'eau (1 L = 1 kg), puis haltères dans le sac (jusqu'à 24 kg). Paliers de
**+1,25 à +2,5 kg**. *Achat optionnel conseillé* : une ceinture de lest (~20–30 €), plus stable que le sac au-delà de 10 kg.

**Pas de critère de sortie** : la phase 3 est la phase « de croisière ». On en sort seulement vers la phase 4
(reprise MMA) ou temporairement vers la phase 2 après une longue interruption (§9.4).

---

### PHASE 4 — Intégration du MMA (surcouche, activable depuis n'importe quelle phase)

La phase 4 n'est pas une étape après la phase 3 : c'est un **mode** qui modifie la phase en cours dès que le MMA
reprend. Détails complets au §10.

**Entrée** : mode « MMA actif » activé **et** ≥ 1 séance MMA/semaine.
**Sortie** : MMA arrêté 2 semaines → retour aux paramètres normaux de la phase en cours.

---

### 5.5 Module jambes (complément optionnel)

Le programme est centré sur le haut du corps, mais un physique athlétique et le MMA demandent des jambes solides.
Le module est volontairement court (2 séries, ~3 min) et **optionnel** : c'est lui que l'on saute en premier quand
le temps manque, jamais les abdos.

| Situation | Séance A | Séance B |
|---|---|---|
| **Mode cheville actif** | Pont fessier unilatéral au sol, 2 × 12–20 / jambe — *si indolore* | Pont fessier unilatéral au sol, 2 × 12–20 / jambe — *si indolore* |
| **Cheville guérie, 4 premières semaines** | Pont fessier unilatéral | Split squat (pied arrière au sol), poids du corps, 2 × 10–15 / jambe |
| **Cheville guérie ensuite** | Soulevé de terre roumain unilatéral haltères, 2 × 10–15 / jambe | Split squat bulgare (pied arrière sur la chaise), haltères, 2 × 8–15 / jambe |

### 5.7 Abdominaux et tronc (dans toutes les séances)

Un bloc abdos **fixe** de 4 à 5 séries en superset termine chaque séance A et B (~4 min). Il est présent dans toutes
les phases, dans la séance F et dans la séance minimale, et il n'est **jamais retiré** par le mode cheville.

**Pourquoi ces exercices** — le tronc a trois fonctions, chacune a son exercice :

| Fonction | Exercice | Séance | Intérêt |
|---|---|---|---|
| **Flexion** (enrouler le buste / le bassin) | Relevés suspendus | A | Grand droit, travail dynamique avec une vraie échelle de difficulté jusqu'aux orteils à la barre |
| **Flexion chargée** | Crunch lesté au sol | B | Seul exercice abdos **chargeable** avec ton matériel : la progression en kg fait grossir le grand droit (« tablettes ») |
| **Gainage / compression** | L-sit aux barres de dips | B | Tronc + fléchisseurs de hanche, très utile en MMA (garde au sol, transitions) ; utilise tes barres |
| **Anti-inclinaison latérale** | Gainage latéral | A | Obliques, stabilité du bassin, transmission des frappes et des projections |

**Volume** : ~12 séries/semaine à 3 séances (≥ 10 conseillées pour l'hypertrophie), ~15–20 en phase 2. Les abdos
récupèrent vite : ce volume ne gêne pas les autres exercices.

**Exercices tenus (L-sit, gainage)** : la « répétition » est une **seconde**. Fourchettes 10–30 s (L-sit) et
20–45 s par côté (gainage latéral) ; R1 propose +5 s par séance, puis la variante suivante une fois le haut atteint
sur toutes les séries. Tenir plus de 45–60 s travaille surtout l'endurance : on durcit la variante plutôt. L'app
fournit un **chrono de maintien** (un tap au début, un tap à la fin) qui remplit la durée.

**Mode cheville** : relevés et L-sit sont suspendus ou en appui sur les mains (aucune charge sur la cheville) ;
crunch au sol sans appui. Gainage latéral : version **sur les genoux** si l'appui sur le bord du pied fait mal.

**Sur le ventre plat** : les abdos se développent avec ce bloc, mais ils ne deviennent **visibles** qu'avec une
masse grasse basse. C'est la perte de poids (§12) qui les révélera, pas des séries supplémentaires.

### 5.6 Rowing inversé sous les barres de dips (tirage horizontal, à tester)

Les tractions tirent **verticalement**. Un tirage **horizontal** développe l'épaisseur du dos (rhomboïdes, trapèzes
moyens, deltoïde postérieur) et équilibre les épaules face au volume de dips et de pompes — utile aussi pour le MMA.

- **Installation** : allongé sous les deux barres de dips, une main sur chaque barre (prise neutre), corps gainé,
  talons au sol. Tirer jusqu'à ce que la poitrine arrive au niveau des barres.
- **Test à la 1ʳᵉ séance de phase 2** : si le dos touche le sol avant que les bras soient tendus, ou si la station
  bascule, l'exercice est abandonné et l'oiseau reste seul (l'app garde ton choix).
- **Échelle** : talons au sol, genoux fléchis → jambes tendues → **pieds sur la chaise** → tempo (pause 2 s en haut) →
  lesté (sac à dos).
- **Cheville** : charge très faible (talons posés) ; autorisé en mode cheville si indolore.
- **Remplace l'oiseau** dans la séance A quand il est retenu (même créneau, même temps).

---

## 6. Échelles de variantes (du plus facile au plus dur)

Quand le haut de la fourchette est atteint, on monte **d'un échelon** et on repart du **bas** de la fourchette.

### Tractions pronation
1. Négatives (descente 4–5 s) — *seulement si < 3 tractions strictes*
2. **Tractions strictes** ← *départ*
3. Tractions tempo (descente 3 s, pause 1 s en haut)
4. **Tractions lestées** (+1,25 → +2,5 kg par palier) ← *phase 3*
5. Variantes avancées (bloc H) : tractions L-sit, tractions archer

### Tractions supination
1. Strictes ← *départ* → 2. Tempo → 3. Lestées

### Dips
1. **Dips stricts** ← *départ* → 2. Tempo (descente 3 s, pause 1 s en bas) → 3. **Lestés** ← *phase 3*

### Pompes (plafond de reps : 20)
1. Pompes sur les genoux *(uniquement si la cheville l'impose)*
2. **Pompes classiques** ← *départ*
3. Pompes déficit (mains sur les haltères, amplitude accrue)
4. Pompes pieds surélevés (pieds sur la chaise)
5. Pompes pieds surélevés + déficit
6. Pompes pseudo-planche (mains au niveau des hanches, buste penché en avant)
7. Pompes archer
8. Pompes lestées (sac à dos)

### Curl haltères (charge max 12 kg → la progression passe ensuite par le tempo)
1. Curl assis, charge croissante par paliers de 2 kg jusqu'à 12 kg (départ probable : 8 ou 10 kg)
2. Curl à 12 kg, tempo descente 3 s
3. Curl concentré assis sur la chaise (1 bras), 12 kg
4. Curl à 12 kg avec pause 2 s en contraction + descente 3 s
5. Rest-pause sur la dernière série

### Élévations latérales (4–12 kg suffisent pour des années ; départ probable : 4 ou 6 kg)
1. Assis, charge croissante
2. Tempo descente 3 s — sert aussi d'**échelon intermédiaire** entre deux charges, car +2 kg sur 4 kg = +50 %
3. Unilatérales penché sur le côté (« lean-away », une main tenant un montant)
4. Myo-reps sur la dernière série (1 série d'activation + mini-séries de 3–5 reps, 10 s de pause)

### Oiseau, extension triceps
Charge croissante → tempo → unilatéral.

### Abdos (§5.7)
- **Relevés suspendus** : genoux à la poitrine → genoux + enroulement du bassin → jambes tendues → orteils à la barre.
- **L-sit** (secondes) : genoux repliés (tuck) → une jambe tendue en alternance → L-sit complet.
- **Crunch lesté** : haltère de 6 → 12 kg (+2 kg) → pause 2 s en contraction → haltère bras tendus au-dessus de la tête.
- **Gainage latéral** (secondes / côté) : sur les genoux *(repli cheville)* → sur les pieds → jambe du dessus levée.

---

## 7. Règles de progression (implémentées telles quelles dans l'app)

Chaque règle porte un identifiant ; le code y fera référence en commentaire (`// R1 — double progression`).
Notations : fourchette `[min, max]`, `S` séries, `RIR_cible`.
**Une « exposition »** = une séance où l'exercice a été effectué.

### R1 — Double progression (règle principale)
- **Si toutes les séries atteignent `max`** et que le ressenti de l'exercice est **Facile ou Correct**
  → **progression** à la prochaine exposition : échelon suivant (§6) ou lest/charge supérieur, reps ramenées à `min`.
- **Si toutes les séries atteignent `max` mais le ressenti est Dur/Limite**
  → **confirmation** : mêmes objectifs. Progression à la prochaine réussite.
- **Sinon** → mêmes paramètres. L'app propose une cible **+1 rep sur la première série encore sous `max`**
  (progression lente, réaliste).

Tailles d'augmentation :
| Type | Palier |
|---|---|
| Lest (tractions, dips, pompes) | +1,25 kg si lest < 10 kg, +2,5 kg au-delà |
| Haltères | **+2 kg** (4 → 6 → 8 → 10 → 12) |
| Poids du corps | Échelon suivant de la variante |
| Charge max atteinte (12 kg) | Échelon tempo/variante suivant (§6) |

**Saut de charge trop grand** (fréquent avec des paliers de 2 kg sur des petites charges) : si, après une hausse de
charge, la 1ʳᵉ série n'atteint pas `min`, l'app ne redescend pas tout de suite. Elle propose un **échelon
intermédiaire** : ancienne charge + **tempo lent** (descente 3 s) jusqu'au haut de la fourchette, puis retente la
nouvelle charge. Le palier de 2 kg reste paramétrable dans le fichier de données si tu changes de matériel.

### R2 — Série sous le minimum
- Une série `< min` → l'app propose de **compléter en négatives** (tractions) ou en **rest-pause** (autres), et
  conserve les mêmes paramètres.
- **2 expositions de suite avec la 1ʳᵉ série `< min`** → la difficulté est trop élevée : retour à l'**échelon
  précédent** ou **lest −5 %**, sauf si la cause est la fatigue (R6) — auquel cas l'app le signale d'abord.

### R3 — Stagnation
Définition : **3 expositions consécutives** à variante et charge identiques sans hausse des **répétitions totales**
par rapport à l'exposition précédant ces trois-là, **avec une forme du jour normale** (R6).
Réponses proposées, dans cet ordre :
1. **Changer le schéma** : séries en *clusters* (ex. 4 × 6 devient 8 × 3 avec 45 s de repos) pendant 2 semaines.
2. **Variante latérale** pour un cycle : pronation → prise neutre ou large ; dips → tempo ; pompes → variante voisine.
3. **Si ≥ 2 exercices stagnent en même temps** → c'est de la fatigue globale, pas un problème d'exercice : **deload anticipé** (R4).

### R4 — Deload (décharge)
- **Planifié** : semaine 6 de chaque cycle.
- **Anticipé** si l'un de ces signaux apparaît :
  - performance des tractions **ou** des dips en baisse de **≥ 10 %** par rapport à la moyenne des
    3 expositions précédentes, **sur 2 expositions consécutives**. Performance = répétitions totales de la séance
    si variante et lest sont inchangés, sinon indice R5 (l'e1RM au poids du corps est trop amorti pour cet usage :
    perdre 3 reps sur la meilleure série ne le fait baisser que d'environ 8 %) ;
  - **3 séances consécutives** avec une forme du jour « basse » (R6) ;
  - R3 point 3 (stagnation multiple) ;
  - douleur articulaire ≥ 4/10 deux séances de suite.
- Un deload anticipé **remet le compteur du cycle à zéro** (le cycle suivant commence après).

### R5 — Indice de performance (comparer des séances qui ne se ressemblent pas)
Les répétitions brutes ne suffisent pas : le poids du corps change (tu vas maigrir) et le lest varie.
Une seule formule pour tout, afin que changer de variante ou ajouter du lest ne « casse » pas la courbe :

- **Charge effective**
  - exercices au poids du corps : `poids de corps × fraction déplacée × coefficient de variante + lest`
    (fraction : tractions 1 ; dips 0,95 ; pompes 0,64 ; rowing inversé 0,5) ;
  - haltères : `charge × coefficient de variante`.
- **Force estimée (e1RM) = charge effective × (1 + (reps + RIR) / 30)** — formule d'Epley corrigée par le RIR,
  calculée sur la meilleure série de la séance, avec le RIR du ressenti de l'exercice.
- Coefficients de variante (pompes : classique 1,0 ; déficit 1,1 ; pieds surélevés 1,2 ; surélevés + déficit 1,3 ;
  pseudo-planche 1,45 ; archer 1,6) : **approximatifs**, ajustables dans le fichier de données. L'important est
  qu'ils soient **constants** : la courbe reste comparable dans le temps.
- Gainage / pont fessier (sans charge) : reps × coefficient de variante.

Conséquence intéressante : en perdant 4 kg à reps égales, ta force relative progresse — l'app le montrera.

### R6 — Forme du jour (questionnaire de 10 secondes avant la séance)
4 curseurs pré-remplis à « normal » : **Sommeil** (1–5), **Énergie** (1–5), **Courbatures** (1–5),
**Douleur cheville** (0–10). Plus : *MMA intense dans les dernières 24 h ?* (oui/non).
- Score `Sommeil + Énergie + (6 − Courbatures)` **≤ 7** → **séance allégée** : −1 série par exercice, RIR +1.
- **MMA intense < 24 h** avant une séance A → séance A allégée (avant-bras et dorsaux déjà sollicités),
  ou proposition d'**inverser A et B**.
- Douleur **articulaire** ≥ 4/10 sur un exercice en cours de séance → l'app retire l'exercice et propose l'alternative
  la plus proche. *Une douleur musculaire (courbature) n'est pas une douleur articulaire.*
- Douleur cheville ≥ 3/10 alors que le mode cheville est désactivé → l'app propose de le réactiver.

### R7 — Changement de phase
Évalué **à la fin de chaque semaine de tests** (semaine 6). Si tous les critères de la phase (§5) sont remplis,
l'app **propose** le passage — elle ne l'impose pas. Le passage se fait au début du cycle suivant.

### R8 — Séance manquée
- Une séance manquée **ne se rattrape pas en doublant** : on reprend simplement l'alternance là où elle s'est arrêtée
  (si A était prévue et manquée, la prochaine séance est A).
- **≥ 10 jours sans séance** → première séance de reprise à −1 série par exercice, RIR +1.
- **≥ 4 semaines sans séance** → voir §9.4.

### R9 — Ce que l'app ne fera jamais
- Augmenter la difficulté sur la seule base des répétitions sans regarder le ressenti.
- Proposer l'échec sur des tractions/dips lestés.
- Ajouter du volume pour « débloquer » une stagnation (le plus souvent, c'est l'inverse qui marche).

---

## 8. Semaine de décharge (deload)

| Paramètre | Valeur |
|---|---|
| Séries | **÷ 2** (arrondi au supérieur, minimum 2 par exercice principal) |
| Reps | Bas de la fourchette |
| Variante / lest | Identiques, lest −10 à −20 % |
| RIR | **3–4** |
| Fréquence | Inchangée |
| Tests de max (§11) | Au **dernier** jour A et au **dernier** jour B de la semaine, à la place de la séance |

Le but : dissiper la fatigue accumulée pour que la fitness « apparaisse ». Les performances remontent souvent après.

---

## 9. Fréquence, planning et disponibilités

### 9.1 Formats hebdomadaires

| Format | Quand | Exemple |
|---|---|---|
| **3 séances** (par défaut) | Phase 1, ou semaine chargée, ou MMA 2×/sem | Lun A · Mer B · Ven A → semaine suivante Lun B · Mer A · Ven B |
| **4 séances** | Phase 2+, bonne récupération, MMA ≤ 1×/sem | Lun A · Mar B · Jeu A · Ven B |
| **2 séances** (semaine difficile) | Manque de temps, MMA ≥ 3×/sem | 2 × **séance F** (full body, ci-dessous) |

**Règle de récupération** : ≥ **48 h** entre deux séances du même type (A-A ou B-B). Deux séances consécutives
(A puis B le lendemain) sont autorisées, jamais trois jours d'affilée.

### 9.2 Séance F — Full body (≈ 28 min)
Pour les semaines à 2 séances : chaque muscle reste stimulé 2 fois.

| # | Exercice | Séries | Reps (selon phase) | Repos |
|---|---|---|---|---|
| 1 | Tractions pronation | 3 | fourchette de la phase | 2 min |
| 2 | Dips | 3 | fourchette de la phase | 2 min |
| 3a | Curl haltères | 2 | 10–15 | enchaîner |
| 3b | Élévations latérales | 2 | 12–20 | 60 s |
| 4 | Pompes | 2 | fourchette de la phase | 90 s |
| 5a | **Abdos** — Relevés suspendus | 2 | fourchette de la phase | enchaîner |
| 5b | **Abdos** — Crunch lesté | 2 | fourchette de la phase | 45 s |

### 9.3 Séance minimale (≈ 15 min) — pour ne jamais « sauter » une semaine
2 séries de tractions + 2 séries de dips + 2 séries de relevés suspendus, RIR 2. Maintenir la masse et la force
demande environ **un tiers** du volume qui les a construites : cette séance suffit à **ne pas régresser** pendant une
semaine compliquée.

### 9.4 Reprise après une longue pause
| Durée d'arrêt | Reprise |
|---|---|
| 2–4 semaines | 1 semaine à volume réduit (−1 série/exercice, RIR 3), puis reprise normale |
| 1–3 mois | Retour **1 échelon en arrière** + 1 cycle en phase 2 |
| > 3 mois | Retour en phase 1, 1 cycle (les progrès reviennent beaucoup plus vite que la première fois) |

---

## 10. Phase 4 — MMA : règles d'intégration

### 10.1 Principe : un budget de fatigue hebdomadaire
Chaque séance consomme des **unités de charge (UC)** :

| Séance | UC |
|---|---|
| MMA technique / drills | 1 |
| MMA sparring, grappling intense, préparation physique MMA | 2 |
| Musculation A ou B (phases 1–2) | 1 |
| Musculation lestée (phase 3, bloc F) | 1,5 |
| Séance minimale | 0,5 |

**Budget conseillé** : **6 UC/semaine** à la reprise, jusqu'à **7–8 UC** après 6 semaines d'adaptation.
Au-delà, l'app propose de **remplacer** une séance de muscu par une séance minimale, ou de passer en format 2 séances F.

### 10.2 Ajustements selon la fréquence MMA

| MMA / semaine | Musculation | Volume | RIR |
|---|---|---|---|
| 1 | 3 séances | −1 série sur l'exercice 1 de chaque séance | +0 |
| 2 | 3 séances | −20 % (−1 série par exercice principal) | +1 |
| 3+ | 2 séances F ou A+B | −30 % | +1, aucune série à RIR 0 |

### 10.3 Placement dans la semaine
1. **Jamais de séance A (tirage) la veille d'un grappling/sparring** : avant-bras et prise fatigués = moins bonnes
   saisies et risque accru.
2. **Pas de musculation le jour d'un sparring intense.** Avec une séance MMA technique, la musculation peut se faire
   le même jour (idéalement ≥ 6 h d'écart, sinon après le MMA).
3. **Au moins 1 jour complet sans aucune séance** par semaine.
4. La séance B (poussée) est la plus facile à caser près du MMA.

Exemple MMA mar + jeu (sparring) : **Lun B · Mer A · Ven B · Sam (ou Dim) repos complet**.

### 10.4 Pendant la phase 3
En période de compétition ou de camp MMA, l'app **gèle le lest** (pas de nouvelle progression de charge) : objectif
maintien. La progression reprend après.

---

## 11. Tests de max (toutes les 6 semaines)

Réalisés pendant la semaine de deload, après l'échauffement complet, **frais**.

| Jour | Test | Protocole |
|---|---|---|
| Dernier A de la semaine 6 | **Tractions pronation max** | 1 série, standard strict (§2). Puis 2 séries légères de curl, fin. |
| Dernier B de la semaine 6 | **Dips max** puis, après **5 min** de repos, **pompes classiques max** | Standard strict. |
| Phase 3 (optionnel) | **Tractions lestées 3RM** | Charge max pour 3 reps propres, paliers de 2,5 kg, 3 min de repos. |

Les pompes sont **toujours** testées en variante classique, quelle que soit la variante d'entraînement : c'est la
seule façon de garder une courbe comparable sur plusieurs années.

---

## 12. Composition corporelle (le minimum utile)

L'app ne fait pas de suivi alimentaire, mais elle suit le **résultat**. Repères :

| Repère | Valeur |
|---|---|
| Rythme de perte de poids | **0,3 à 0,7 % du poids par semaine** (≈ 0,25–0,6 kg) — au-delà, on perd du muscle |
| Protéines | **1,6 à 2,2 g/kg/jour** → ~140–170 g pour toi (calculé sur le poids objectif, 78 kg, minimum 125 g) |
| Déficit | ~300–500 kcal/jour sous la maintenance |
| **Objectif de poids** | **78 kg** (−8 kg) |
| Durée réaliste | **16 à 24 semaines** (4 à 6 mois) à 0,35–0,5 kg/semaine. Prévoir **1 à 2 semaines à la maintenance** à mi-parcours (vers 82 kg) : la fatigue du déficit s'accumule et les performances en profitent. |
| Point de contrôle | À 80 kg : si le tour de taille est déjà < 89,5 cm et que tu veux plus de muscle, l'app proposera de passer en légère prise de masse plutôt que de continuer à maigrir. Tu restes décisionnaire. |
| Indicateur prioritaire | **Tour de taille / taille < 0,5** → tour de taille < 89,5 cm pour 1,79 m |
| Fréquence des mesures | Poids : 3–7 fois/semaine au réveil (l'app affiche la **moyenne sur 7 jours**). Mensurations : toutes les 2 semaines. Photos : toutes les 4 semaines, même lumière. |

Signaux surveillés par l'app :
- Perte > 1 %/semaine sur 2 semaines **et** performances en baisse → message : *déficit probablement trop agressif*.
- Poids stable **et** tour de taille en baisse **et** performances en hausse → **recomposition réussie**, rien à changer.

---

## 13. Ce que l'application devra stocker (préparation de l'étape 2)

Pour appliquer ces règles, l'app enregistrera au minimum :
- par **série** : exercice, variante, reps réalisées, reps prévues, lest/charge, négatives éventuelles, horodatage ;
- par **exercice dans la séance** : ressenti (Facile / Correct / Dur / Limite) — **1 seul tap** ;
- par **séance** : type (A, B, F, minimale, test), phase, cycle, semaine du cycle, forme du jour (R6), durée, poids du corps du jour ;
- **MMA** : date, type (technique / intense), durée ;
- **corps** : poids, tour de taille, mensurations, photos (optionnel, stockées localement) ;
- **état du programme** : phase, cycle, semaine, échelon et lest actuels par exercice.

Le programme lui-même (exercices, variantes, fourchettes, coefficients, seuils des règles R1–R8, budget UC) sera
dans `src/data/programme.json`, commenté par un `PROGRAMME.md` qui reste la référence humaine.

---

## 14. Décisions validées

| Point | Décision |
|---|---|
| Haltères | 4–12 kg, paliers de 2 kg (paramétrable) |
| Pompes et cheville | Pointe de pieds indolore → pompes normales, repli prévu |
| Objectif de poids | 78 kg |
| Barres de dips | Hauteur standard → rowing inversé **à tester** en phase 2 (§5.6) |
| Disponibilités | Tous les jours → planning par défaut : **Lun · Mer · Ven** (3 séances) ou **Lun · Mar · Jeu · Ven** (4 séances), décalable librement dans le calendrier en respectant la règle des 48 h (§9.1) |

---

## 15. Rappels et alertes (contenu ; la technique est traitée à l'étape 2)

Un rappel n'est utile que s'il arrive **au bon moment** et **pas trop souvent** : trop de notifications et on finit par
les ignorer. Chaque type de rappel peut être activé/désactivé, avec une heure et un **message personnalisable**.

| Rappel | Quand (par défaut) | Message par défaut (modifiable) |
|---|---|---|
| **Séance du jour** | Jour de séance prévu, 18 h 00 | « Séance {seance} aujourd'hui · {duree} min. {exercice1} en premier. » |
| **Séance non faite** | Même jour, 21 h 00, si la séance n'a pas été validée | « Toujours pas fait ? Même la séance minimale (15 min) compte. » |
| **Pesée** | Lun · Mer · Ven, 7 h 30 | « Pesée au réveil, avant de manger. » |
| **Mensurations** | Toutes les 2 semaines, dimanche 10 h | « Tour de taille et mensurations du jour. » |
| **Semaine de tests** | Lundi de la semaine 6 | « Semaine de décharge + tests de max. Lève le pied, tu vas battre tes records. » |
| **Photo** (optionnel) | Toutes les 4 semaines | « Photo de suivi, même endroit, même lumière. » |

Variables utilisables dans les messages : `{seance}` (A, B, F…), `{duree}`, `{exercice1}`, `{phase}`, `{semaine}`,
`{poids_objectif}`, `{prenom}`.
Le rappel « séance non faite » ne se déclenche **jamais plus d'une fois par jour** et aucun rappel n'est envoyé
pendant les jours de repos prévus.
