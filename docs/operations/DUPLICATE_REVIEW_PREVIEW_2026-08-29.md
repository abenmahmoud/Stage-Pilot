# Détection et validation des doublons

Date : 29 août 2026
Périmètre : branche `codex/lycee-connect-prototype`, preview uniquement

## Parcours

1. À la création, le serveur recherche une demande de même catégorie créée dans
   les sept jours avec le même contact haché.
2. Une correspondance crée seulement un événement `duplicate_suspected` dans le
   nouveau dossier.
3. L'espace agent affiche le dossier candidat uniquement si l'agent peut
   consulter les deux dossiers.
4. La file signale le dossier avec « Doublon ? » et propose un filtre dédié.
5. L'agent ouvre les deux dossiers puis choisit « Dossiers distincts » ou
   « Confirmer ».
6. La décision est ajoutée à l'audit avec l'agent et l'heure. Elle peut être
   corrigée par une décision ultérieure sans effacer l'historique.

## Protections

- Aucune comparaison de coordonnées en clair et aucun journal de coordonnées.
- Aucun numéro candidat ni statut de doublon dans l'API publique du demandeur.
- Aucune fusion, fermeture, suppression ou copie automatique de contenu.
- Contrôle d'accès sur le dossier courant et le dossier candidat.
- Contrôle de concurrence par version du dossier avant la décision.

## Preuves locales

```powershell
npm run test:support-duplicates
npm run test:support-routing
npm run test:support-agent-access
npm run test:support-concurrency
npm run test:support-agent
npm run build
```

Résultat : 39 contrôles ciblés réussis et build TypeScript/Vite réussi.

Le rendu a aussi été chargé avec des données fictives à 1440 × 1000 et 390 ×
844. Le panneau, le badge et le filtre sont visibles. Les cinq filtres occupent
exactement la largeur disponible sur téléphone, sans débordement horizontal ni
erreur console.

## Limites

- Le signal est volontairement prudent : un même contact peut déposer plusieurs
  demandes légitimes. L'agent doit toujours lire les deux dossiers.
- Aucun test n'a utilisé de contact, dossier ou donnée réelle.
- Aucune production, base distante, notification, DNS, VPS, Webmail, ENT ou
  PRONOTE n'a été modifié pendant ce lot.
