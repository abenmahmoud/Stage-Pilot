# Revue du raccordement entrant

## Mission et consommation

Fable 5, une exécution autorisée sur quatre fichiers : orchestrateur,
persistance, tests unitaires et recette PostgreSQL. Lecture seule, aucun outil,
MCP, sous-agent, donnée réelle ou secret. Plafond demandé : 1,50 USD.
Consommation estimée par le CLI : 0,706451 USD, dont 0,013411 USD pour son appel
auxiliaire Haiku. Exécution terminée avec rapport, aucune relance.

## Arbitrage Codex

| Constat | Conclusion |
| --- | --- |
| Échec générique de téléchargement nommé persistance | Corrigé : transfer_failed, avec conservation des erreurs fermées du transport. Les pannes de stockage sont également distinguées. |
| Violation du contrat de contenu nommée persistance | Corrigé : content_invalid ; les conflits de réservation restent distincts. |
| Traversée de chemin par le jeton | Non confirmée : le transport applique encodeURIComponent au segment, avec hôte et préfixe fixes ; les tests de transport vérifient le chemin encodé et le refus de redirection. Une clé opaque peut légitimement contenir un slash encodé. |
| Indice et UUID non validés | Non confirmé : le helper HMAC existant impose UUID et indice 0 à 19 avant tout accès. Imposer seulement UUID v4 ou autoriser l'indice 20 contredirait le contrat existant. |
| Rattrapage d'un conflit rejetant un objet propre | Harmonisé par défense : mêmes buckets autorisés et même contrôle de chemin que le rejeu principal. Test de conflit injecté ajouté. La course ordinaire décrite est normalement empêchée par le verrou parent. |
| Harnais ignorant le prédicat reserved | Corrigé : vérification du paramètre et retour vide hors reserved ; un test exerce directement le rejeu de confirmation. Cela ne transforme pas le harnais en moteur SQL. |
| Verrou conservé pendant le dépôt | Compromis conservé pour empêcher scan/purge concurrents avant confirmation ; transport borné et attente de verrou limitée à cinq secondes. Les codes PostgreSQL 55P03, 40P01 et 40001 deviennent database_busy sans message distant. |

## Limites explicites

Le nouveau code et les corrections ont seize tests locaux. Le scan et les
services fournisseur/stockage restent simulés. La recette SQL de réservation
existante passe sur la preview avec rollback et cinq résidus nuls. La nouvelle
recette de l'orchestrateur ne s'est pas connectée : paramètres locaux non
utilisables, sans essai de production ni modification de secrets.

T022I reste ouverte jusqu'à cette validation. Le webhook n'est pas raccordé,
aucun antivirus n'est exécuté et la limite d'admission n'est pas distribuée.
Les corrections après rapport ont été vérifiées par Codex, pas réauditées par
une seconde exécution externe.
