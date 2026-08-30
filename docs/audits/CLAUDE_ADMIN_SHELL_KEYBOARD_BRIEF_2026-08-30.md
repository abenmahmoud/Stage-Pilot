# Brief Claude - navigation clavier de l’espace agent

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise. Aucun jeton externe n’a été
consommé.

## Mission proposée

Auditer en lecture seule le shell agent sur clavier et technologies d’assistance.
Chercher les doublons de navigation, pertes de focus, contrôles sans nom, ordre
incohérent ou panneau modal dont le focus peut s’échapper.

## Périmètre minimal

- `src/components/AppLayout.tsx` ;
- `scripts/test-admin-shell-accessibility.mjs` ;
- diff Git du lot.

Aucun compte, navigateur distant, Vercel, Supabase, `.env`, donnée réelle ou
outil d’écriture.

## Questions

1. Le menu fermé reste-t-il atteignable par un lecteur d’écran ou Tab ?
2. Le focus revient-il vers une cible visible après chaque fermeture ?
3. Le piège de focus couvre-t-il premier et dernier contrôle dans les deux sens ?
4. Le lien d’évitement atteint-il un repère unique et focalisable ?

## Arrêt

Une seule passe, rapport court par sévérité avec fichier, preuve et correction
minimale. Aucune relance ni extension de périmètre.
