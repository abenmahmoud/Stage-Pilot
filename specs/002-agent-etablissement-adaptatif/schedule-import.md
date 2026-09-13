# Import privé des emplois du temps

## Mise en service progressive — 13 septembre 2026

Un gestionnaire peut activer les calendriers iCal appliqués/validés et garder les
autres en attente. GET/POST `schedule/admin/imports/:id/publish`, réservé à
`requireScheduleManager`. Un bilan strict donne les nombres prêts/en attente,
une empreinte et la publication active. POST exige cette empreinte, la
confirmation ACTIVER et une justification. Aucun nom, fichier, référence ou
cours privé ne figure dans ce nouveau contrat public de gestion.

Une nouvelle version conserve une copie privée de l’export scanné, la date
d’effet, la fraîcheur et un lien `origin_source_id` vers l’import encore en
revue. Seuls les calendriers inclus/appliqués, reliés à l’annuaire actif, avec
page vérifiée et cours approuvés, sont copiés. Les pages sont renumérotées ;
la preuve originale reste conservée intégralement. Les triggers existants
approuvent/activent cette version complète du périmètre validé ; ils ne sont
pas contournés. Les candidats en attente restent modifiables dans l’original.

Un nouvel ajout validé peut ensuite faire l’objet d’une nouvelle publication,
en conservant les calendriers déjà disponibles. Une tentative qui retirerait
un calendrier actif est refusée. Verrous de périmètre et source, empreinte du
contenu et contrôle avant copie, activation atomique, audit de l’acteur connecté,
reprise idempotente après réponse perdue. Une copie de tentative échouée n’est
supprimée qu’après reprise du verrou et confirmation de l’absence de référence
committée. Une coupure empêchant ce nettoyage nécessite un contrôle d’exploitation.

La migration distingue les publications dérivées des imports dédupliqués et
verrouille leur preuve/fraîcheur. Aucune source périmée n’est prolongée par une
publication. Les droits personnels, l’OTP, les groupes et les restrictions de
lecture restent ceux des lecteurs existants. Tests de contrats dans
`scripts/test-schedule-publication.mjs` et preuves d’intégration privées.

Mise en service réelle du 13 septembre, autorisée par Adel : 88 calendriers
enseignants et 43 calendriers classes actifs ; les imports originaux gardent
respectivement 16 et 2 candidats en attente, sans exclusion. L’interface et les
agrégats SQL confirment l’activation. Les classes publiées sont reliées à
1 077 élèves et 1 368 responsables de l’annuaire courant. Aucun groupe individuel
confirmé dans cet annuaire : la publication ne rend pas les cours de groupe
accessibles sans appartenance et ne garantit pas un EDT individuel complet.
Un essai sur un vrai appareil élève/parent reste à effectuer ; l’activation ne
crée aucune session d’identité et ne déclenche aucun OTP ou message.

## Aperçu de contrôle avant activation — 13 septembre 2026

Le gestionnaire peut choisir un calendrier iCal déjà rattaché/appliqué et un jour
dans « Tester une journée ». Lecture directe des créneaux approuvés de cette
version, sans changement d’état et sans identité d’élève simulée. Affichage
séparé des cours en classe entière et en groupe ; une absence de créneau ne
signifie ni journée ni salle libre. Le statut de version et le besoin de
recontrôle sont explicites. Les deux calendriers en attente ne sont pas exclus
pour débloquer cet aperçu.

Endpoint GET privé `schedule/admin/imports/:id/preview`, contrôle gestionnaire,
établissement, calendrier, source scannée et page vérifiée. Transaction cohérente
en lecture seule, limite 101 lue/100 restituée, aucun résultat tronqué silencieux,
dates Paris et contrat strict. Tests dans `scripts/test-schedule-admin-preview.mjs`.

## Dépôt groupé du 13 septembre 2026

Le format iCal accepte un ZIP de fichiers `.ics` ou plusieurs `.ics` sélectionnés
ensemble. Le navigateur prépare un seul fichier iCal, sans modifier les noms de
calendriers, UID, horaires ou salles. Le ZIP peut contenir un dossier d’export ;
seuls les fichiers accessoires connus de Windows/macOS sont ignorés. Autre
document, chiffrement, corruption, doublon ambigu ou chemin dangereux : aucun
dépôt partiel. Limites : 50 Mo compressés et décompressés, 250 calendriers, 1 000
entrées ZIP, 60 secondes de préparation. Extraction séquentielle avec plafond
sur les octets réellement émis, CRC et contrôles de structure zip.js 2.14.1.

Un seul transfert dans `schedule-ingest`, puis le circuit existant de quarantaine,
antivirus, lecture, correspondances, approbation et activation. La réservation
du format `text/calendar` est reconnue dans le validateur strict du navigateur.
Chaque mise à jour manuelle repasse par cette page avec l’export complet du
périmètre ; classes et professeurs restent séparés.

Tests : `scripts/test-schedule-calendar-files.mjs`, réservation iCal dans
`scripts/test-schedule-admin-payload.mjs`, parcours fictif complet de 45 calendriers
sur ordinateur et téléphone avec CSP de production. Aucun import réel dans ce lot.

## Implémentation iCal du 10 septembre 2026

Le format natif `ical_import` relie désormais les occurrences UTC exportées aux
calendriers privés vérifiés. Plusieurs fichiers ICS peuvent former un lot, sans
conversion Excel ni limite de 80 cours annuels. Le worker propose les correspondances
depuis l’annuaire actif ; les lignes avec avertissement non bloquant sont admises
comme pour l’OTP. Les chiffres des classes restent significatifs. Toute ambiguïté
reste à résoudre humainement. Les associations de groupes ne sont jamais déduites.

Un gestionnaire choisit explicitement les rattachements/exclusions, puis approuve
et active la version. Le chat affiche les cours autorisés, les salles et horaires
de Paris dans des cartes imprimables. Une proposition de demande laisse le chat
ouvert ; le formulaire ne s’ouvre qu’à la demande de l’utilisateur. Voir
`docs/operations/IMPORT_ICAL_CHAT_2026-09-10.md` pour la recette et les limites.

Les sections datées antérieures ci-dessous conservent le diagnostic historique.

## Données iCal retrouvées le 10 septembre 2026

Les fichiers existent dans les téléchargements : 45 calendriers dans `EDT 8-9-26`,
104 dans `ical`, 45 dans `ical 2`, couvrant l’année 2026-2027. Le lecteur du chat
n’est pas encore relié à ces exports. Le format ICS n’est pas pris en charge par
l’import publié ; une conversion annuelle dépasse également les limites actuelles
du pipeline tabulaire. L’annuaire fournit 43 correspondances exactes de classe,
mais aucun lien d’appartenance aux groupes. Voir le diagnostic et les critères
de livraison T066C dans `docs/operations/DIAGNOSTIC_ICAL_2026-09-10.md`.

## Consultation par le chat — état du 9 septembre 2026

Le lecteur personnel peut répondre dans le chat pour le prochain cours,
aujourd’hui ou demain. Une réponse courte « demain » après une demande personnelle
conserve ce sujet, sans réduire les contrôles d’identité et de périmètre.
Les cours sont présentés séparément avec horaire, matière, salle et changement
officiel. Il n’y a pas de remise automatique de PDF au demandeur dans ce parcours.
Le choix d’un enfant pour un parent reste à raccorder au chat.

Contrôle de production du 9 septembre : aucune version EDT ni aucun créneau
importé dans l’établissement. Le lecteur fonctionnel sur données fictives ne
constitue donc pas un EDT réellement disponible. Preuves :
`docs/operations/TEXTES_ET_AUTONOMIE_AGENT_2026-09-09.md`.

## Sources examinees

Les deux exports dates du 25 aout 2026 ont ete examines localement :

- 102 pages pour les emplois du temps des professeurs ;
- 45 pages pour les emplois du temps des classes ;
- une grille hebdomadaire par page, avec cours, groupes, salles et alternances ;
- plusieurs groupes simultanes peuvent partager un meme creneau.

Aucun nom, horaire individuel ou contenu des PDF n'est ajoute a Git, aux
specifications ou a la preview.

## Decision proportionnee

L'extraction de texte brute n'est pas assez fiable pour transformer directement
toutes les grilles en creneaux : les colonnes de groupes se chevauchent dans le
PDF. La premiere version doit donc privilegier la preuve et la recherche rapide,
pas une reponse automatique incertaine.

1. Televerser le PDF dans un stockage prive reserve aux agents.
2. Enregistrer son empreinte, sa date d'effet, son type et son numero de version.
3. Indexer chaque page vers une classe ou un professeur apres controle humain.
4. Permettre a l'agent d'ouvrir la bonne page par un lien temporaire.
5. N'activer une nouvelle version qu'apres validation, en conservant la version
   precedente pour un retour arriere.
6. Ajouter la lecture detaillee des creneaux seulement apres constitution d'un
   jeu de controle et mesure du taux d'erreur.

## Regles de reponse de l'agent

- Ne jamais rendre public l'emploi du temps complet d'un professeur.
- Ne repondre qu'a la personne et au besoin autorises.
- Afficher la date de la source et signaler qu'un emploi du temps peut changer.
- En cas de doute, montrer la page source a l'agent humain au lieu d'inventer un
  horaire, une salle ou un professeur.
- PRONOTE ou l'outil officiel reste prioritaire lorsqu'une integration autorisee
  et plus recente est disponible.

## Autorisation et protections restantes

Le 27 août 2026, le propriétaire du projet a explicitement demandé d'utiliser
ces deux exports réels dans LyceeGest, projet Vercel `safe-scol/lyceegest`.
Cette autorisation est enregistrée et n'a pas besoin d'être redemandée pour
construire le flux d'import privé en preview.

Les fichiers ne doivent toutefois jamais être ajoutés à Git, intégrés au bundle
web ou servis par une URL publique.

Le 29 aout 2026, le socle suivant est appliqué uniquement à la preview :

- bucket `schedule-ingest` privé, PDF seulement, 50 Mo maximum ;
- tables serveur `schedule_source_versions`, `schedule_page_indexes` et
  `schedule_audit`, avec RLS forcée et droits client révoqués ;
- dépôt réservé à la direction sous MFA, version automatique et confirmation de
  la taille et du type reçus ;
- une seule version active par établissement, périmètre et année scolaire ;
- pages rattachées uniquement à une référence opaque de classe ou de personnel ;
- aucune activation depuis l'écran tant que les contrôles suivants manquent.

Avant le premier téléversement réel, il reste à installer et tester l'antivirus,
compter les pages, construire le rapprochement humain, ouvrir les pages par lien
temporaire audité, définir la conservation et vérifier les comptes nominatifs.
Tant que ces protections ne sont pas actives, les PDF restent uniquement sur le
poste local.

## Jalon technique du 29 août 2026

- La file durable `schedule_document_scan` est créée uniquement sur la preview,
  avec RLS forcée et aucun droit `anon` ou `authenticated`.
- La confirmation place désormais le PDF en quarantaine et crée atomiquement le
  travail d'analyse ; un ancien dépôt `uploaded` peut être repris sans double
  activation.
- Le worker préparé dans Git exécute ClamAV avant l'inspection PDF, vérifie la
  signature et la structure, calcule SHA-256 et compte au plus 500 pages.
- Aucun texte, nom, horaire, salle ou contenu du PDF n'est extrait et aucun
  fournisseur d'IA n'est appelé.
- Le worker n'est pas encore installé sur le VPS : l'état `review` ne sera donc
  opérationnel qu'après autorisation, installation additive et recette fictive
  comprenant un PDF sain, EICAR, reprise et nettoyage.
- Une version en `review` possède maintenant un poste de rapprochement vertical,
  sans tableau horizontal : chaque page reçoit une référence opaque puis une
  validation distincte. Modifier une ligne vérifiée la repasse en brouillon.
- La base refuse une page supérieure au comptage vérifié, un type classe/personnel
  incompatible et toute modification lorsque la source n'est plus en `review`.
- La direction peut ouvrir le PDF entier par un lien privé de 60 secondes sous
  MFA, avec audit et réponse `no-store`. Ce lien administratif ne constitue pas
  encore le futur lien limité à une page pour l'agent.

## Contrat d'approbation et d'activation

- L'approbation exige une source en `review`, un contrôle antivirus propre, une
  empreinte SHA-256, un comptage vérifié et exactement une référence vérifiée
  pour chacune des pages du PDF.
- L'approbation et l'activation exigent une justification de 20 à 1 000
  caractères. L'activation demande en plus la confirmation explicite
  `ACTIVER` ; un retour arrière demande `RESTAURER` et un retrait `RETIRER`.
- Chaque mutation prend un verrou transactionnel. L'activation verrouille le
  périmètre établissement-type-année, remplace l'éventuelle version active et
  journalise les deux opérations dans la même transaction.
- Le retour arrière ne recrée pas les données : il réactive une version
  `superseded`, remplace la version courante et conserve toutes les preuves.
- Une contrainte PostgreSQL revalide les pages et le contrôle du document à
  chaque promotion. Les routes applicatives ne peuvent donc pas contourner ces
  invariants.
- Ce contrat prépare le flux en preview mais n'autorise ni import réel ni
  activation réelle avant la recette du worker et la validation des comptes
  nominatifs.

## Retrait et conservation

- Une version active ne peut pas être retirée : une version de remplacement doit
  d'abord être activée.
- La direction sous MFA peut retirer une version en revue, approuvée, remplacée,
  refusée ou en échec avec une justification et la confirmation `RETIRER`.
- Le retrait est logique et transactionnel. Il coupe les routes de lecture,
  empêche toute réactivation et conserve un audit minimal.
- Tant que la direction et le DPO n'ont pas validé une durée, la politique reste
  `pending_dpo`, la date de purge reste vide et `storage_purge_status` reste
  `blocked`. Aucun original ni fichier mono-page n'est supprimé.
- La planification et la purge physique seront ajoutées seulement après la
  décision T004 et une recette de restauration ; elles restent dans T042C2D.

## Préparation des pages privées du 1er septembre 2026

- Après un résultat ClamAV propre et un comptage PDF stable, le worker prépare
  un PDF distinct par page. Il ne transmet aucun contenu à un fournisseur d'IA.
- Le découpage est borné à 500 pages, 12 Mo par page et 100 Mo au total. Les
  annotations et actions supplémentaires sont retirées des copies destinées à
  la consultation rapide.
- Les objets utilisent uniquement établissement, version et numéro de page dans
  un chemin déterministe. La table `schedule_page_assets` est privée, sous RLS
  forcée, sans droit client et verrouillée après la phase `processing`.
- La promotion PostgreSQL recompte les objets privés et refuse l'approbation si
  une seule page manque, même si le résumé du worker annonce le contraire.
- La route de lecture exige un compte direction sous MFA, une page indexée et
  vérifiée, le même établissement et une version encore consultable. Elle ne
  signe que la copie mono-page pendant 60 secondes et journalise l'action.
- Le navigateur refuse un lien dont l'origine, le coffre, la version ou le
  numéro de page ne correspond pas exactement à la demande, avant navigation.

Le code, les tests fictifs, le build et les audits de dépendances sont validés
localement. La migration n'est pas encore appliquée à la preview et le worker
n'est pas installé : le CLI et le connecteur Supabase étaient injoignables lors
de cette passe. Aucun PDF réel ni objet de stockage n'a été créé.
