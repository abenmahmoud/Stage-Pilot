# Reprise humaine persistée - 30 août 2026

## Conditions

La persistance réapplique la politique après verrou du travail mort et de sa
livraison : rôle superadmin ou proviseur, MFA `aal2`, confirmation explicite,
cause compatible et livraison non terminale.

## Écriture

- le travail d'origine reste `dead` et n'est jamais modifié ;
- un successeur `pending` repart avec zéro essai ;
- sa clé d'idempotence est un HMAC de l'établissement et du travail d'origine ;
- un double clic ne crée ni deuxième travail ni deuxième événement ;
- seul le premier succès écrit l'acteur nominatif et des métadonnées bornées.

## Limites

La route privée, l'écran de boîte d'échec et la recette DB fictive restent à
faire. Aucun travail n'est exécuté et aucun secret distant n'est configuré.
