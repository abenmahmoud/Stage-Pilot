# Portail numérique — Lycée Blaise Cendrars (LyceeGest)

Dépôt `abenmahmoud/Stage-Pilot`. Branche unique de travail :
`codex/lycee-connect-prototype`. Ne jamais pousser ailleurs.

## Interdits absolus
- Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
- Aucune mutation Vercel, Supabase distant, VPS, DNS, Hostinger, Webmail, ENT, PRONOTE.
- Ne jamais lire, copier, résumer ni committer `~/Documents/LyceeGest-DONNEES-PRIVEES`.
- Jamais de recherche libre par nom dans le répertoire d'identités.
- Codes d'accès, documents personnels et actions officielles : validation humaine.
- Ne jamais lancer un modèle externe payant sans accord explicite (périmètre + plafond).

## Règles de travail
- Un lot = une tâche Spec Kit. Ne pas fermer une tâche sans preuve réellement exécutée.
- Une preuve locale n'est pas une recette distante. Le dire explicitement.
- Migrations : jamais `--linked`, jamais `db push`, jamais d'URL distante.
  Les recettes tournent sur pile Supabase locale jetable uniquement.
- Avant commit : `npm run build` + `npm run test:preview-security-gate`.
- Les compteurs Spec Kit ne sont pas un taux de disponibilité du service.

## Où chercher (ne pas charger en entier)
- Tâches : `specs/*/tasks.md`
- Historique long (355 Ko, ne jamais lire en entier) : `specs/project-memory.md`
  → utiliser `grep` sur la section demandée.
- Passation courante : le plus récent `docs/operations/CLAUDE_HANDOFF_*.md`
- Chartes et méthode : `specs/002-agent-etablissement-adaptatif/`

## Commandes utiles
- `/recette` : suite de contrôles locale complète
- `npm run test:preview-security-gate`
- `npm run test:spec-integrity`
- `npm run test:migration-integrity`
- `npm run build`

## État au 3 septembre 2026
Tâche ouverte : `002/T010B4B` (identité email sur appareil). Drapeaux
`IDENTITY_DEVICE_ACCESS_ENABLED` et `VITE_IDENTITY_DEVICE_ACCESS_ENABLED` à `false`.
Bloquant : les 94 migrations n'ont pas encore été rejouées sur un PostgreSQL réel
(Docker Desktop indisponible lors du dernier lot).