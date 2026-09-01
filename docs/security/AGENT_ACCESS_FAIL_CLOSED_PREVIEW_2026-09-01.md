# Accès agents : contrôles obligatoires en preview

## Correctifs

Le garde API `requireRole` vérifie d'abord l'utilisateur auprès d'Auth. Pour
`superadmin`, `proviseur`, `administration` et `agent`, il exige ensuite que le
niveau courant retourné par l'API existante soit `aal2`. Une absence de facteur,
une ancienne variable désactivée ou une indication dans le profil ne suffit pas.
Une erreur ou une réponse d'assurance absente échoue sans accès aux données.

`requireSupportAgent` relit ensuite l'adhésion active, liée à l'utilisateur et à
l'établissement configuré. Les services viennent de cette adhésion, pas du
profil. Un rôle global exige encore une adhésion `admin`. La valeur absente de
`SUPPORT_MEMBERSHIP_SOURCE` vaut `database` ; `metadata` et toute autre valeur
sont refusées. Aucun repli en cas de panne, suspension ou révocation.

Le garde React oriente les agents AAL1 vers `/security` avec le retour local.
L'enrôlement reste accessible après connexion. Avant AAL2, le bouton Retour
mène à l'accueil, pas vers une page qui redemande immédiatement la vérification.
Le formulaire public et les élèves/professeurs hors rôle agent ne changent pas.

Les deux pages de connexion partagent `safeAuthReturnPath` : parseur URL,
origine locale, borne 2 048 caractères, contrôle des antislashs et contrôles,
refus des chemins réseau avant et après normalisation. Une valeur telle que
`/a/..//outside.invalid` ne devient pas un lien sortant après normalisation.

## Preuves locales

- `test:agent-security-gates` : 13 tests. Auth et le garde support sont vraiment
  transpilés et exécutés ; fournisseur et base sont remplacés par des doubles
  fictifs. Les filtres de requête sont évalués, pas seulement recherchés en texte.
- Cas : variables absentes/fausses, non-enrôlé, AAL inconnu, rôle interdit,
  utilisateur absent, erreur fournisseur, adhésion absente/invitée/désactivée,
  autre utilisateur/établissement, suspension, panne base, rôle global sans
  adhésion admin, services modifiés et niveau dégradé entre deux requêtes.
- Les véritables fonctions de garde React sont extraites via TypeScript puis
  rendues : redirection des agents AAL1, contenu AAL2, accès à l'enrôlement,
  conservation des autres rôles, absence de contenu privé pendant le chargement.
- Compilation, barrière complète de sécurité, 9 tests adversariaux et 4 contrats
  responsive passent. L'avertissement XLSX préexistant reste présent.
- Fixture navigateur sur le vrai composant de sécurité et les styles compilés,
  avec Auth fictive : activation, défi et confirmation, 320 et 1 440 px.
  Aucun débordement du contenu ; liens et messages vérifiés. Aucun QR code,
  facteur, email ou secret réel utilisé. Ce n'est pas une recette Supabase Auth.

## Déploiement et limites

Preview seulement, sans mutation d'environnement ni de schéma. Un ancien compte
agent AAL1 doit s'enrôler avant de lire les données. Aucune baisse de contrôle
n'est prévue pour le dépanner : utiliser la procédure institutionnelle et deux
responsables enrôlés avant une future promotion autorisée.

La réponse d'assurance reste liée au JWT et au comportement du SDK existant.
Ce lot ne prouve ni l'invalidation immédiate d'un JWT après retrait de facteur,
ni la révocation des sessions Auth distantes. Le réseau Auth, les comptes
nominatifs et leur récupération doivent encore être éprouvés.

La contre-revue externe de ce lot n'a pas été autorisée ni exécutée. Le passage
de 2 USD proposé précédemment concerne les résumés seulement : ne pas lui ajouter
ce périmètre sans nouvel accord. T049C et T007B restent ouvertes.

Une nouvelle proposition regroupant les deux lots a été soumise avec le même
plafond de 2 USD et un seul passage. Elle n'a pas encore reçu d'accord ; son
brief est `docs/audits/FABLE_5_1_ACCESS_AND_SUMMARIES_REVIEW_BRIEF_2026-09-01.md`.

La publication de documents personnels reste distincte : il manque un lien
opérationnel entre session de suivi, identité scolaire et relation parent-enfant.
Un statut manuel du dossier ou AAL2 de l'agent n'est pas cette preuve.

Références vérifiées le 1er septembre 2026 :
[MFA et contrôle côté serveur](https://supabase.com/docs/guides/auth/auth-mfa),
[niveau d'assurance du SDK](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel).
Le changelog officiel a été consulté ; aucune nouvelle API ni version de SDK
n'est introduite par ce lot.
