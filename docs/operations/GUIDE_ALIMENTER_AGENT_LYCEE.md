# Alimenter l'agent avec les données du lycée

État vérifié le 4 septembre 2026 sur le pilote actuellement relié au domaine
du lycée : registre de connaissances vide, aucun document de connaissance ni
répertoire d'identités importé. Les 78 fichiers du site sont conservés.
Un fichier visible sur le site ne devient pas automatiquement une source de
l'agent. La préparation locale du répertoire ENT n'a pas été activée en ligne.

## Où déposer les fichiers maintenant

Un dossier local a été préparé pour Adel, hors des dépôts Git :

`C:\Users\adelb\AppData\Local\LyceeBlaiseCendrars\DepotPrive`

Ses droits Windows sont limités à Adel, au système et aux administrateurs du
PC. Ce dossier sert à préparer les fichiers : ce n'est ni un coffre chiffré,
ni un import automatique, ni une source déjà accessible à l'agent.

| Dossier local | Contenu attendu | Destination dans le portail |
| --- | --- | --- |
| `01-Documents-generaux` | Horaires, formulaires vierges, procédures publiques, informations de rentrée | Connaissances de l'agent, classification publique après validation |
| `02-Procedures-internes` | Procédures réservées aux personnels, consignes de traitement sans secrets ni dossiers individuels | Connaissances de l'agent, classification interne et services autorisés |
| `03-Annuaire-sans-codes` | Export minimal des personnes, contacts et relations, sans mots de passe ni codes d'accès | Répertoire des identités, import privé et activation séparée |

Conserver les codes d'accès dans leur outil officiel actuel. Ne pas les mettre
dans ces trois dossiers, dans le chat ou dans le registre de connaissances.
Indiquer seulement leur service et leur usage pour préparer le circuit adapté.

## Documents : parcours déjà présent

Avec un compte direction ou superadministrateur et la vérification renforcée :

1. Ouvrir [Connaissances de l'agent](https://lycee-blaise-cendrars-sevran.fr/admin/connaissances-agent).
2. Choisir **Documents → Ajouter un document**.
3. Renseigner le titre, l'usage, le service responsable, la confidentialité,
   la date de validité et la date de révision.
4. Déposer le document pour analyse. Le stockage `knowledge-ingest` est privé ;
   le contrôle antivirus et l'extraction sont effectués par le worker.
5. Relire la proposition. La validation crée une source en brouillon : elle
   n'autorise pas encore l'agent à l'utiliser.
6. Publier la source, l'associer à une compétence et valider les scénarios
   avant d'activer la version de compétence.

Formats reconnus : PDF, DOCX, XLSX, PPTX, TXT, CSV, JPG et PNG, au maximum
50 Mo par fichier. Les images sans texte exploitable nécessitent une lecture
humaine. Commencer avec quelques procédures connues pour vérifier leurs réponses.

L'agent consulte les extraits validés nécessaires à la question, selon le
public autorisé et les dates. Les documents internes ne deviennent pas des
réponses publiques. Les originaux restent privés.

## Annuaire et documents personnels

Le [Répertoire des identités](https://lycee-blaise-cendrars-sevran.fr/admin/repertoire-identites)
accepte CSV/XLSX et possède un stockage chiffré des identités. Il sert à
vérifier une personne et ses relations autorisées. La liste complète n'est pas
envoyée au modèle. La source, les colonnes et le périmètre doivent être vérifiés
avant l'activation d'un export réel sur la cible retenue.

Une pièce nominative liée à une demande reste dans son dossier privé. Elle
ne doit pas être publiée comme connaissance générale. Un document individuel
à remettre sans demande existante exige son propre classement et une règle
d'accès liée au bénéficiaire.

## Codes : circuit à raccorder

Le coffre des identités existant stocke des noms et coordonnées ; ce n'est pas
encore un coffre de remise de codes ENT/PRONOTE. Les imports actuels refusent
les mots de passe, OTP, codes d'accès et secrets d'activation.

La cible pour une remise de code est : code chiffré lié au bon bénéficiaire,
recherche exacte par le serveur, contrôle de l'identité et de la relation,
validation humaine, remise limitée dans le temps et journal sans valeur secrète.
Le modèle prépare la demande et reçoit seulement le résultat de l'action ;
le code brut ne passe pas dans sa mémoire ni dans ses consignes.

Un numéro de badge ou une référence de cantine peut être un simple identifiant.
S'il ouvre un accès ou permet une action à lui seul, il relève du circuit des
secrets. Adel précise que les fichiers contiennent des codes d'activation ENT
et des codes de badge cantine. La vérification demandée utilise l'adresse déjà
présente dans l'annuaire officiel, avec un défi à usage unique. Une adresse
saisie dans une conversation ne remplace pas celle de l'annuaire ; le contact,
la personne et, pour un parent, la relation avec l'élève doivent correspondre.
Le circuit de remise reste à raccorder ; les règles actuelles de validation
humaine des accès sensibles restent en vigueur.

## Références vérifiées dans le projet

- `src/pages/admin/KnowledgeRegistryPage.tsx` et `IdentityDirectoryPage.tsx`
- `api/knowledge/admin/documents/index.ts`
- `api/_shared/public-knowledge-context.ts`
- `specs/002-agent-etablissement-adaptatif/methode-enseignement-agent.md`
- `docs/operations/KNOWLEDGE_DOCUMENT_PIPELINE_CONVERGENCE_2026-08-30.md`

Cette note n'effectue aucun import réel, aucune activation ni aucun envoi de code.
