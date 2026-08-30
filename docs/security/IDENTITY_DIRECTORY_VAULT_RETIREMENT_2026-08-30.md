# Vérification locale du retrait d'une ancienne clé du coffre

## Objectif

Avant de retirer une ancienne clé de chiffrement du répertoire d'identités, le
lot vérifie sur un échantillon borné que toutes les enveloppes utilisent la
version cible et restent lisibles avec cette seule clé.

## Garanties

- 250 enveloppes au maximum par lot ;
- établissement et version d'import attendus obligatoires pour tout le lot ;
- structure fermée pour chaque ligne et chaque enveloppe ;
- refus d'une version différente de la cible ;
- déchiffrement authentifié AES-256-GCM sans restitution du texte clair ;
- refus si une ancienne clé annoncée comme retirée est encore chargée ;
- empreinte SHA-256 agrégée sur les enveloppes vérifiées, sans identité en clair.

Le test utilise deux personnes entièrement fictives, vérifie les altérations,
les doublons, les versions incomplètes et les anciennes clés encore présentes.

## Limite opérationnelle

Cette preuve locale ne retire aucune clé et ne parcourt aucune base. Le retrait
réel exige une sauvegarde chiffrée restaurable, une vérification exhaustive de
la version active sur la preview, une fenêtre d'intervention et une autorisation
explicite. T010B2C reste donc ouverte.
