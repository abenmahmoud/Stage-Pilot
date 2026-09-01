# Identité scolaire et périmètre d'emploi du temps

## Résultat

Le lecteur serveur existant vérifie désormais l'ensemble de la chaîne avant
d'appeler le lecteur d'emploi du temps privé : compte authentifié, établissement,
identité scolaire unique, assurance autorisée, source active, fiche courante,
relation parent-enfant éventuelle, fiche élève cible et groupes autorisés.
Le code, les tests et les requêtes SQL sont vérifiés ; ce n'est pas une preuve
de parcours utilisateur connecté, ni une autorisation de remise de document.

## Constats reproduits

Les quatre tests antérieurs cherchaient des motifs dans le code. Les nouveaux
tests exécutent le module réel, avec un fournisseur Auth fictif, une horloge
fixe et un double relationnel qui évalue les jointures et les conditions.
Avant correction, 9 des 16 groupes de scénarios échouaient. Ce nombre ne
représente pas neuf failles distinctes : il inclut aussi les nouvelles exigences
de cohérence et de bornage.

- Une fiche personne absente ou périmée pouvait laisser des groupes utilisables.
- Un personnel obtenait sa référence enseignant sans exiger une fiche valide.
- La première identité de plusieurs types pouvait être retenue arbitrairement.
- Une relation n'exigeait pas la validité de la fiche du parent et le type élève
  de la cible. L'autorisation existante `guardian_of` et ses dates étaient déjà
  contrôlées ; cette protection n'était pas absente.
- Les références étaient normalisées ; une conversion n'est pas un rapprochement
  officiel entre les identifiants de deux sources.

## Corrections

Les lectures se font dans une transaction `repeatable read`, `read only`, selon
l'[API de transaction Drizzle](https://orm.drizzle.team/docs/transactions).
La source est épinglée à l'identité et relue active dans les jointures. Chaque
personne doit avoir exactement une fiche valide de cette source. Les niveaux
`directory_matched` et `official_sso` sont acceptés ; le premier exige un agent
vérificateur. Une date de vérification future ou invalide est refusée.

Un parent n'obtient aucun enfant choisi implicitement. Une cible explicite autre
que soi exige le lien `guardian_of` actif et daté, dans le même établissement
et la même version, et une fiche de type `student`. Plusieurs enfants sont
testés séparément, jamais fusionnés. Le parcours public de choix d'enfant reste
à réaliser après validation du libellé minimal affichable.

Pour le personnel, seule sa propre référence enseignant est autorisée, sans
classe ni groupe ajouté. Pour l'élève, seules sa classe et ses appartenances
courantes sont utilisées. Les références de classes, groupes et enseignants
doivent déjà correspondre au format canonique du lecteur privé, sans conversion
de casse. Les incohérences demandent une correction de source, pas un droit de
repli. Le quarante-et-unième groupe bloque la lecture plutôt que de tronquer.

Les refus d'autorisation partagent un message générique sans nom ni identifiant.
Une panne ne permet jamais l'appel au lecteur privé. Aucun résultat d'identité,
preuve ou contact n'est ajouté au résultat public.

## Preuves

- `npm run test:schedule-identity-reader` : quatre contrats historiques et
  seize scénarios dynamiques passent. Dates inclusives, deux enfants, révocations,
  autre établissement, source remplacée, ambiguïtés, références, dépassement et
  absence de repli sont couverts. Ces tests rejoignent la barrière de sécurité.
- `scripts/schedule-identity-sql-recipe.mjs` compile le module et le schéma réels,
  capte les cinq requêtes Drizzle du parcours parent et produit trente cas SQL.
  Chaque nom de table est masqué par une CTE contenant uniquement des fixtures.
  La génération n'ouvre aucune connexion et n'utilise aucune variable secrète.
- La recette produite a été exécutée sur `guichet-lycee-preview`, branche non
  principale `xijocumlwivhbmffrnlj`, après vérification de cible : **30 cas,
  30 réussis, aucun échec**. Transaction en lecture seule terminée par rollback.
  Aucune création de table ou de compte, aucune ligne persistante, aucun accès
  aux personnes réelles. Cette preuve confirme la syntaxe et les prédicats SQL,
  pas les contraintes, permissions RLS ou performances des tables physiques.
- La barrière complète `test:preview-security-gate` passe, sans migration.
- Compilation, six tests d'intégration logique avec l'assistant, quatre contrats
  responsive et intégrité Spec Kit passent. Aucun composant visuel n'a changé ;
  ces contrats ne sont pas une nouvelle recette visuelle ou privée Auth/MFA.

## Limites encore ouvertes

- La possession d'une session de suivi, d'un email ou le statut manuel d'un
  dossier ne lie toujours pas son destinataire à cette identité scolaire.
  Classification des réponses et pièces, bénéficiaire et autorisation de remise
  doivent être implémentés avant l'utilisation de documents personnels.
- La vérification est cohérente au début de la transaction. Une révocation
  concurrente est observée à la requête suivante, pas présentée comme un arrêt
  rétroactif d'une réponse déjà autorisée. Aucun droit n'est mis en cache.
- Le jour UTC existant est conservé. La lecture de plusieurs identités pour un
  même compte exige un choix explicite futur ; elle ne sélectionne pas un rôle.
- Aucune recette Auth réelle, OTP, SMS, notification, charge réseau ou import réel.
- Aucune contre-revue externe exécutée : mission Fable 5.1 proposée avec un
  plafond de 2 USD, un passage. Le propriétaire demande ensuite un report d'au
  moins deux heures faute de quota ; aucun lancement automatique. Aucun coût
  fournisseur pour ce lot.
- Production, Hostinger, DNS, VPS, Webmail, ENT et PRONOTE inchangés.

T049C5 clôt ce correctif du lecteur existant ; T049C et T042D2D restent ouverts.
