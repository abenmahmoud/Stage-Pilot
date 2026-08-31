# Brief Claude - adaptateur `support.create_request`

## Statut

Brief préparé uniquement. Aucun modèle externe n'a été lancé. Une exécution
exige une autorisation actuelle qui fixe le fournisseur, le modèle, le périmètre,
les permissions, le plafond et le format de sortie.

## Mission bornée et en lecture seule

Examiner uniquement :

- `shared/support-assistant-routing-receipt.ts` ;
- `shared/support-create-request-action-confirmation.ts` ;
- `api/_shared/support-create-request-action.ts` ;
- `api/_shared/public-knowledge-context.ts` ;
- `api/support/assistant.ts` ;
- `api/support/requests/index.ts` ;
- `src/pages/prototype/LyceeConnectPrototype.tsx` ;
- `scripts/test-support-create-request-action.mjs`.

Chercher en priorité : contournement d'autorisation, rejeu sur un autre appareil
ou établissement, course transactionnelle, défaut d'idempotence, faux succès,
fuite de données dans le registre, compétence non publiée acceptée et activation
accidentelle par défaut.

Ne pas modifier de fichier, variable, secret ou service. Ne pas appeler Vercel,
Supabase, GitHub, Claude Code, ENT, PRONOTE, Webmail ou un réseau externe. Ne pas
utiliser de donnée réelle.

## Sortie attendue

Constats classés par sévérité avec fichier et ligne, scénario reproductible,
impact, correction minimale et test manquant. Signaler explicitement l'absence de
constat bloquant et les risques résiduels.
