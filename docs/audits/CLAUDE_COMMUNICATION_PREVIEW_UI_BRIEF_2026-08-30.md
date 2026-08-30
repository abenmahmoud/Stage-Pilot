# Brief d'audit Claude - aperçu éditorial des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-ui.mjs`
- `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule le mode `Écrire` / `Aperçu` du composeur privé.
Vérifier le rendu à 320 px et au clavier, l'absence de HTML brut exécutable, la
neutralisation des images distantes, l'isolation des liens et le confinement
des tableaux. Confirmer qu'aucun destinataire, audience, droit de publication,
appel d'envoi ou donnée réelle n'a été introduit. Ne modifier aucun fichier et
ne lancer aucun déploiement.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
