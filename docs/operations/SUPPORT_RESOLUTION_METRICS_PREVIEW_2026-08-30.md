# Indicateurs de résolution - recette preview

## Périmètre

- Écran réservé à la direction et à la superadministration avec MFA.
- Fenêtre d'activité : 30 jours glissants.
- Base consultée : `guichet-lycee-preview` uniquement.
- Aucun dossier, message, sujet, nom ou moyen de contact retourné.

## Indicateurs

- demandes créées et résolues dans la fenêtre ;
- taux de résolution de cette cohorte ;
- délai moyen et percentile 90 parmi ses demandes résolues ;
- stock total actuellement ouvert dans l'établissement ;
- cinq catégories fermées les plus fréquentes dans la fenêtre.

Le stock ouvert est volontairement un instantané global et non la seule cohorte
des 30 jours. Les deux notions sont affichées séparément.

## Sécurité

Chaque agrégat filtre `institution_id` avec l'établissement persistant du compte
agent. L'API ne reçoit pas ce périmètre depuis le navigateur. Les catégories
proviennent d'une énumération fermée ; aucun texte libre n'entre dans l'agrégat.

Les tests verrouillent l'authentification opérations, le filtre établissement,
la limite de cinq catégories et l'absence de champs d'identité ou de contenu.

## Résultat de la preview

Le 30 août 2026, la lecture agrégée a retourné 11 demandes créées, zéro demande
résolue et 11 demandes ouvertes. Aucun contenu individuel n'a été consulté.
L'interface affiche `Aucune résolution` tant qu'aucun délai ne peut être calculé.

## Limite

Ces chiffres valident le calcul et le cloisonnement, pas la qualité opérationnelle
du service. Les objectifs de délai et seuils d'alerte restent une décision de la
direction avant l'ajout d'engagements ou d'escalades automatiques.
