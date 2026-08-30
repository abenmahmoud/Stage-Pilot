# Politique prudente des archives publiques

## Règle de preview

Le flux public sépare deux ensembles sans modifier les données :

- `En cours` : publication active, non expirée et non retirée ;
- `Archives` : publication arrivée à sa date d'expiration, mais non retirée.

Une direction peut retirer manuellement un contenu en le passant à l'état
`archive`. Ce retrait prévaut toujours : le contenu disparaît du flux courant,
des archives et de son ancien lien public. Cette règle évite qu'une information
retirée pour erreur, confidentialité ou décision éditoriale ressorte plus tard.

## Sécurité et pagination

Le mode est validé côté serveur et inscrit dans le curseur opaque. Un curseur du
flux courant ne peut pas être rejoué dans les archives. Les deux modes exigent
une version publiée, une audience `tous`, une date de publication atteinte et
un état différent de `archive`. Les tables restent inaccessibles directement
aux rôles navigateur.

## Validation attendue

La preview peut être évaluée avec cette règle prudente. La validation métier
doit seulement confirmer si les contenus expirés doivent rester visibles sans
limite ou pendant une durée déterminée. Aucun retrait manuel ne sera rendu
public par ce choix futur.

## Preuve preview

La recette `public_content_expired_archive_security.test.sql` a été exécutée sur
`xijocumlwivhbmffrnlj`. Elle retrouve exactement un contenu courant, exactement
un contenu expiré et aucun contenu retiré dans ces deux ensembles. Le rollback
laisse les trois compteurs de résidus à zéro.

Un navigateur Chromium réel a ensuite vérifié le flux avec des réponses réseau
fictives à 1 440 x 1 000 et 390 x 844 : aucune erreur console, aucun débordement
horizontal, deux commandes de 40 px sur téléphone et sélection Archives
correctement exposée par `aria-pressed`.
