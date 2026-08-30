# Mesures techniques de l'agent - recette preview

## Périmètre

- Base : branche Supabase `guichet-lycee-preview` uniquement.
- Interface : `/admin/sante-demandes`, direction et superadministration.
- Périodes : 7 et 30 jours.
- Production, DNS, VPS, Webmail, ENT et PRONOTE : non modifiés.

## Données conservées

Une mesure contient uniquement l'issue technique, le modèle éventuellement
appelé, la latence, les jetons, le nombre de sources, le nombre de tours et une
estimation de coût. Elle ne contient aucun texte, nom, compte, contact, session,
document, catégorie métier ou erreur brute.

## Coût estimé

Le calcul est désactivé tant que les deux variables suivantes ne sont pas
définies sur l'environnement concerné :

```text
OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS
OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS
```

Les valeurs représentent des euros par million de jetons. Elles doivent être
validées lors de chaque changement de modèle. L'écran affiche une estimation,
jamais un montant de facturation.

## Sécurité vérifiée

- RLS activée et forcée ; aucune politique client.
- Aucun droit de lecture pour `anon` ou `authenticated`.
- `service_role` limité à `SELECT/INSERT`.
- Un déclencheur refuse toute modification ou suppression.
- API limitée à l'établissement de l'adhésion active, sous MFA.
- Réponse API agrégée, sans ligne individuelle.

## Résultat de la recette

Une transaction a inséré une mesure entièrement fictive, vérifié le blocage de
`UPDATE` et `DELETE`, lu l'agrégat puis exécuté `ROLLBACK`. Le contrôle final
retourne zéro mesure. Les avis Supabase propres à cette table sont informatifs :
RLS sans politique client et index inutilisés sur une preview vide.

L'audit des dépendances livrées en production retourne zéro vulnérabilité.
L'audit incluant les outils de développement signale neuf avis transitifs dans
Vercel et Drizzle ; le correctif automatique proposé imposerait des changements
majeurs forcés. Ils restent suivis comme risque d'outillage et ne sont pas
masqués par une rétrogradation non testée.

## Reste à décider

- Durée de conservation avec la direction et le DPO.
- Tarifs exacts du modèle avant d'afficher un coût.
- Mesure des transferts de service et corrections humaines dans T030.
