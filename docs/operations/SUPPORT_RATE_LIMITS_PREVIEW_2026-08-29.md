# Preuve preview - limites multidimensionnelles du guichet

## Périmètre

- Dépôt : `abenmahmoud/Stage-Pilot`
- Branche : `codex/lycee-connect-prototype`
- Supabase : branche `guichet-lycee-preview` uniquement
- Migration : `20260829205947_add_multidimensional_support_rate_limits.sql`
- Production, DNS, Hostinger, VPS, Webmail, ENT et PRONOTE : non modifiés

## Contrôles réalisés

- 48 tests ciblés réussis : nouvelles limites, accès, secrets, mémoire appareil,
  concurrence métier, agent, traduction et conversation.
- Build TypeScript et Vite réussi.
- Parcours d'aide contrôlé à 1 440 px et 390 px : assistant visible, aucun
  contrôle coupé, aucun débordement horizontal et aucune erreur navigateur.
- La migration conserve les 17 compteurs déjà présents sur la preview.
- `support_rate_limits` : RLS activée et forcée.
- Privilèges `SELECT` de `anon` et `authenticated` : `false`.
- Clé imposée au format hexadécimal HMAC-SHA-256 de 64 caractères.
- Essai transactionnel : trois consommations acceptées, quatrième refusée ;
  transaction annulée et zéro ligne synthétique restante.
- Avis sécurité Supabase : aucun nouvel avertissement de niveau erreur. Le signal
  informatif « RLS sans politique » est attendu pour cette table serveur privée,
  dont les droits clients sont révoqués.

## Garanties vérifiées

- Compteur PostgreSQL partagé et atomique, jamais en mémoire serverless.
- Aucun identifiant réseau, appareil, contact ou compte stocké en clair.
- Absence de clé commune `network:unknown` pouvant bloquer tous les usagers.
- En production Vercel, seul `X-Vercel-Forwarded-For` alimente le garde-fou
  réseau ; `X-Forwarded-For` reste réservé au développement local.
- Les créations sont limitées séparément par appareil, contact et répétition.
- Les fichiers et les écritures agent disposent de compteurs distincts.

## Avant production

1. Exécuter une charge fictive avec plusieurs appareils derrière la même adresse
   réseau et vérifier qu'aucun blocage collectif n'apparaît.
2. Tester les réponses `429` avec des profils peu à l'aise en français.
3. Valider les seuils et la durée technique des compteurs avec la direction et le
   DPO.
4. Prévoir une observation agrégée des blocages, sans conserver les contenus.
