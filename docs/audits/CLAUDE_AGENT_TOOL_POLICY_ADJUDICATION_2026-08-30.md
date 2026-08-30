# Arbitrage de l'audit Claude - outils de l'agent

## Portée

Claude a relu en lecture seule le commit `19010d1` sur huit fichiers. Son rapport
est un avis externe ; les constats ci-dessous ont été vérifiés dans le code et la
preview avant correction.

| Constat Claude | Verdict | Traitement |
| --- | --- | --- |
| F1 : absence de persistance et consommation atomique A3 | Confirmé avant intégration, pas exploitable sans outil actif | Tables privées, audit et consommation sous verrous ajoutés en preview ; rejeu refusé par recette transactionnelle. |
| F2 : heure fournie à la politique | Confirmé comme exigence d'intégration | Le contrat impose l'horloge serveur ; la base utilise `transaction_timestamp()`. Aucun champ client ne doit alimenter les dates de sécurité. |
| F3 : empreinte non recalculée depuis l'entrée | Confirmé | SHA-256 canonique recalculé depuis l'entrée assainie ; substitution testée et refusée. |
| F4 : file de service sans MFA dans la matrice | Confirmé dans la politique | `service_queue` exige désormais `aal2`. Le branchement complet de la matrice aux API reste T015B. |
| F5 : approbation ignorée pour A0-A2 | Amélioration retenue | Une approbation inattendue provoque maintenant un refus explicite. |
| F6 : approbation indépendante pour toute compétence | Non imposé sans décision métier | Toutes les publications exigent déjà une validation et MFA ; l'indépendance obligatoire de chaque classification doit être décidée avec les responsables et plusieurs comptes nominatifs. |
| F7 : A3 possible avec `userId` nul | Non confirmé | Le contrôle existant refusait déjà ce cas dans `validApproval`; une garde et un test explicites ont été ajoutés pour éviter toute ambiguïté. |
| F8 : statuts négatifs peu testés | Confirmé | `rejected`, `expired` et `cancelled` sont maintenant couverts explicitement. |

## Vérification supplémentaire

La première inspection réelle de la preview a révélé un privilège `DELETE`
implicite de `service_role`, absent du rapport Claude et invisible dans les tests
statiques. Une migration additive l'a retiré. La vérification finale confirme :

- RLS activée et forcée sur les trois tables ;
- aucun `SELECT` pour `anon` ou `authenticated` ;
- aucun `DELETE` serveur sur les trois tables ;
- aucun `UPDATE` serveur sur l'audit ;
- fonction atomique `security invoker`, `search_path` vide et exécution refusée
  aux rôles clients.

Le conseiller performance ne trouve plus de clé étrangère non indexée dans ces
trois tables. Il les signale seulement comme inutilisées, résultat attendu sur
un coffre vide avant pilote.

T016 et T017 restent closes. T018 reste ouverte pour l'interface et le
branchement ; T028 reste ouverte jusqu'au premier adaptateur autorisé et à
l'affichage fondé sur `confirmed_at`.
