# Plan de nuit — 3 septembre 2026 : préparation d'un pilote RÉEL

Objectif de la nuit : produire le dossier qui permet de décider, en connaissance
de cause, l'ouverture du guichet à de vrais élèves et parents. Ce n'est PAS un
lot de fonctionnalité.

Contexte vérifié : Docker répond (server 29.3.1). Branche
`codex/lycee-connect-prototype`. Preview à 94 migrations, production à 3.

Règles pour TOUS les lots (en plus de `CLAUDE.md`) :
- Aucune donnée réelle, aucun email, aucun drapeau, aucune action distante.
  La barrière `.claude/hooks/deny-remote.ps1` bloque ; ne la contourne jamais.
- Commit local après chaque lot. Ne jamais pousser.
- Distingue toujours PROUVÉ / SUPPOSÉ / À DÉCIDER PAR UN HUMAIN.
- Tu ne produis aucun avis juridique : tu produis des BROUILLONS destinés à la
  direction et au DPO académique, explicitement marqués comme tels.
- N'invente aucun délai, aucun responsable, aucune durée de conservation :
  laisse un champ « à compléter par la direction ».

---

## LOT 1 — Rejeu des 94 migrations sur PostgreSQL jetable

1. `docker info`
2. `npm run test:local-production-shape-migration-safety`
3. `npx --yes supabase@2.116.0 start`
4. `npm run recipe:local-production-shape-migration`
5. Relève migrations appliquées, échecs, durée. Laisse la pile allumée pour le
   LOT 2.

Fini quand : les 94 migrations passent, ou l'erreur exacte est documentée.

## LOT 2 — Répétition de la promotion production 3 → 94

Sur la pile locale uniquement, reproduis la forme réelle de la production :
1. Pars d'une base ne contenant QUE les 3 migrations de production.
2. Applique les 91 versions manquantes dans l'ordre, en relevant chaque échec.
3. Teste le code applicatif ACTUEL contre le schéma final (`npm run build` +
   les suites de sécurité).
4. Vérifie que le code de production actuel (commit `a9cf32e`) ne casse pas sur
   ce schéma, ou documente précisément ce qui casse.

Fini quand : un avis go / no-go écrit, avec la liste ordonnée des opérations et
le retour arrière prévu. Aucune action sur la vraie production.

## LOT 3 — Audit de préparation à un pilote réel

Parcours le dépôt et les `tasks.md` des cinq domaines. Produis
`docs/operations/PILOTE_REEL_BLOQUEURS_2026-09-03.md` : la liste EXHAUSTIVE et
vérifiée dans le code de ce qui empêche d'accueillir de vraies personnes.

Pour chaque bloqueur : ce qui manque · la preuve absente · qui doit l'autoriser
(direction, DPO, propriétaire, prestataire) · est-ce du code ou une décision ·
la tâche Spec Kit correspondante.

Classe en quatre familles : gouvernance et données personnelles · promotion et
sauvegarde de la production · comptes et authentification · canaux (email
entrant, antivirus, pièces jointes).

Ne compte pas une tâche comme faite parce qu'elle est cochée : vérifie dans le
code ou marque-la « déclarée, non revérifiée ».

## LOT 4 — Paquet gouvernance à faire valider

Écris dans `docs/gouvernance/` des BROUILLONS destinés à la direction et au DPO,
construits uniquement à partir de ce que le dépôt prouve réellement :
- `MENTIONS_INFORMATION_v0.md` — ce que le service collecte, pourquoi, combien
  de temps, qui y accède, quels droits.
- `REGISTRE_TRAITEMENT_v0.md` — finalités, catégories de personnes et de
  données, destinataires, durées (champs vides à compléter), mesures de
  sécurité réellement en place (cite les preuves du dépôt).
- `QUESTIONS_DPO_v0.md` — les questions ouvertes, dont : responsable de
  traitement, rôle exact d'ESSUF GROUP et nécessité d'un contrat de
  sous-traitance, nécessité d'une analyse d'impact compte tenu des données de
  mineurs, durées de conservation, sort du répertoire d'identités.

Aucune affirmation juridique : ce sont des documents de travail.

## LOT 5 — Périmètre proposé pour une v1 réellement ouverte

Écris `docs/operations/PERIMETRE_V1_PILOTE_REEL.md`. Pars du principe qu'on
réduit le périmètre pour ouvrir vite et proprement, plutôt que d'attendre tout.

Propose ce qu'on GARDE (guichet public, suivi par appareil et par email, console
agent, réponses, statuts) et ce qu'on COUPE au démarrage (répertoire
d'identités, lecture d'emploi du temps, documents personnels, identité sur
appareil, communications de masse). Pour chaque coupe : ce qu'on perd, et la
condition exacte pour la rouvrir ensuite.

Termine par la liste ordonnée des tâches Spec Kit à faire pour CE périmètre
seulement, avec pour chacune : code ou décision humaine.

## LOT 6 — Clôture (toujours exécutée)

1. `npm run build`
2. `npm run test:preview-security-gate`
3. `npm run test:spec-integrity`
4. Écris `docs/operations/CLAUDE_HANDOFF_PILOTE_REEL_2026-09-03.md` : ce qui est
   prouvé cette nuit, ce qui reste ouvert, et les trois décisions que le
   propriétaire doit prendre en premier.
5. Commit local. Ne pousse pas.