# Audit applicatif Fable 5.1 : constats et corrections

## Verdict

Audit externe ciblé effectué, puis contre-vérifié par Codex. Deux défauts
prioritaires sont corrigés dans les sources et couverts par des régressions
locales. Aucun P0 n'a été prouvé dans les quinze fichiers examinés. Cela ne
constitue ni un audit exhaustif, ni une certification, ni un feu vert public.

## Exécution autorisée

- Accord explicite du propriétaire, une exécution native en lecture seule,
  plafond de 5 USD. Modèle retourné : `claude-fable-5-1`.
- Sources au commit `2894150d485d0ecb24c302f23cfde70afce0a4cb`, quinze fichiers,
  169 433 caractères. Périmètre et exclusions dans le brief adjacent.
- Aucun outil, MCP, hook, sous-agent ou accès autonome au dépôt. Aucun secret,
  fichier privé ou donnée personnelle transmis. Aucun compte, dossier réel,
  email ou SMS créé par cet audit.
- Rapport reçu normalement en environ 158 secondes. Pas de relance Claude
  après correction : les vérifications qui suivent sont celles de Codex.
- Le CLI annonce 0,994904 USD, mais indique une base tarifaire `unknown` pour
  Fable 5.1 : ce nombre n'est pas une facture fiable. Usage Fable : 2 jetons
  d'entrée, 69 148 jetons d'écriture de cache, 9 938 de sortie. Aux tarifs
  officiels vérifiés le 1er septembre (10 / 12,50 / 50 USD par million),
  estimation : 1,361270 USD. Le CLI a aussi enregistré un appel auxiliaire
  Haiku de 0,054964 USD. Total estimé : **1,416234 USD**, sous le plafond.
  La facturation effective reste à contrôler chez le fournisseur.
- Sortie brute, manifeste des empreintes et journal restent dans le répertoire
  local ignoré `.vercel/audits/fable-5-1-application-security-2026-09-01/`.
  L'autorisation est consommée, sans réserve d'exécutions supplémentaires.

Source des tarifs et de l'identifiant :
[documentation officielle Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview).

## Arbitrage Des Constats

### P1 : rejeu d'une création accordant un accès tiers

**Confirmé et corrigé.** Le conflit sur une clé anti-doublon relisait la demande,
puis ajoutait la session de l'appelant à ses autorisations. Une clé connue ou
réutilisée pouvait donc ouvrir le dossier. Une fuite réelle de clé n'a pas été
constatée ni recherchée sur des utilisateurs réels.

Dans `api/support/requests/index.ts`, la reprise exige maintenant une relation
préexistante entre la session valide et ce dossier, dans le bon établissement.
Elle n'insère plus aucune autorisation. Sans relation, réponse 409 générique,
sans numéro de dossier ; la transaction annule aussi la session provisoire.
Le rejeu autorisé conserve le même dossier, sans message ni notification ajouté.

Les corrections proposées par Claude ont été adaptées : comparer les coordonnées
et le texte déclarés ne prouve pas une identité ; inclure la session dans la clé
unique pourrait créer un doublon lors d'une reprise sur un autre appareil.
La contrainte d'unicité d'origine est conservée.

### P1 : vérification limitée aux catégories ENT et email académique

**Confirmé pour les dossiers I3, corrigé sur ce périmètre.** Le routage calcule
déjà I3 pour certains dossiers de vie scolaire, affectation ou emploi du temps.
La réponse agent ignorait ce niveau en dehors des deux catégories historiques.

`shared/support-reply-policy.ts` est désormais utilisé pour l'envoi, la
traduction, la clôture et l'interface. I3 exige l'identité scolaire confirmée.
I4 reste fermé : la confirmation manuelle actuelle ne vaut que I3. Les dossiers
historiques sans niveau valide sont réévalués avec le routage existant. Le verrou
historique ENT/email n'est jamais abaissé, même avec un niveau d'urgence I0.

En attente de vérification, seul le texte sécurisé et sa traduction signée sont
permis, sans pièce jointe. L'interface masque les pièces préparées et transmet
une liste vide. Les demandes d'urgence I0 de vie scolaire peuvent toujours
recevoir une consigne d'aide. Les formulaires vierges et l'accueil administratif
I2 ne sont pas tous transformés en I3.

**Limite conservée et à traiter avant données personnelles :** le niveau de
routage n'est pas une classification du contenu sortant. Un document personnel
dans une demande I2 exige encore une politique explicite de publication et un
contrôle de la relation parent/enfant. Il ne faut pas conclure que toute réponse
libre ou pièce jointe est devenue sûre. La collecte urgente ne donne jamais un
droit sur des données scolaires privées.

La proposition Claude utilisait un niveau inexistant `identite_confirmee` à la
place de I0-I4 et imposait I3 à toute pièce. Elle n'a pas été copiée telle quelle.

### P2 : identité d'appareil et maîtrise du coût IA

**Confirmé, reste ouvert.** Un identifiant d'appareil déclaré peut être renouvelé
pour contourner ce quota. Les plafonds réseau et contact existent : ils ne
disparaissent pas. Le cookie brut n'est pas non plus une preuve sans validation.
Prochain lot : identifiant anonyme émis et signé côté serveur, rattachement à
une session vérifiée, plafond global de consommation et test distribué. Ne pas
baisser arbitrairement les seuils réseau : les élèves partagent le réseau du lycée.

### P2 : MFA et adhésions nominatives

**Conditionnel à la configuration, pas une exposition distante prouvée.**
Le défaut de configuration du code autorise encore `metadata` et une MFA non
obligatoire pour les agents non enrôlés. Le mode `database` vérifie l'adhésion
active. La mémoire du projet indique ce mode activé sur la branche de preview ;
elle n'est pas une preuve fraîche du déploiement courant.

La suspension de l'établissement est déjà contrôlée par
`requireConfiguredInstitution`, même en mode metadata : cette partie du constat
Claude est infirmée. Le statut de révocation d'une adhésion est `disabled`, pas
`revoked`. À vérifier avant ouverture : configuration courante, comptes nominatifs,
MFA obligatoire, révocation effective et refus immédiat sur chaque service.

### P2 : provenance du résumé français

**Confirmé, reste ouvert.** Le navigateur peut fournir `internalSummaryFr` et
`detectedLanguage`, actuellement marqués automatiques. Le texte est neutralisé et
l'interface demande une vérification, mais la provenance n'est pas authentifiée.
Prochain lot : afficher « résumé transmis, à vérifier » pour les champs déclarés,
ou produire et lier un résumé côté serveur au message exact. Un hash non lié au
contenu original ne suffit pas. Ne jamais fonder une autorisation sur ce résumé.

### P3 : perte d'une réponse lors d'un échange de lien magique

**Scénario plausible, reprise à tester.** La consommation du lien et la révocation
peuvent être confirmées avant la réception du nouveau cookie. Ne pas appliquer
la proposition `revokedAt` dans le futur : les lectures actuelles exigent NULL,
donc elle révoquerait immédiatement. Un délai de grâce prolongerait aussi les
sessions compromises. Conserver la révocation ; éprouver la récupération par
un nouveau lien/code et le recours humain. Le retrait d'un appareil existe déjà
via `api/support/session.ts`, contrairement à une absence supposée dans le rapport.

### P3 : identifiant de pièce jointe mal formé

**Confirmé et corrigé.** La validation exige désormais la structure UUID exacte
avant tout accès ou cast PostgreSQL. Les identifiants invalides produisent 400,
pas une erreur de base. Aucun changement d'autorisation sur les fichiers.

### P3 : choix de l'enfant pour son emploi du temps

**Écart fonctionnel, pas fuite démontrée.** L'assistant ne transmet pas encore
`targetPersonRef`. Prévoir un choix limité aux enfants liés à l'identité vérifiée,
jamais une recherche libre par nom ouvrant un emploi du temps. La validation
serveur `guardian_of`, ses dates et le contrôle de source restent obligatoires.

## Vérifications Et Limites

- 18 nouvelles régressions passent : exécution du véritable gestionnaire de
  création avec double relationnel transactionnel, sessions propriétaire/tiers/
  absente/inconnue/expirée/révoquée, institution distincte, aucun octroi ni effet
  secondaire au rejeu. Les refus ne révèlent pas le numéro du dossier.
- Le véritable gestionnaire de réponse refuse les textes et pièces I3 non
  autorisés. La consigne sécurisée, I3 confirmé et l'aide I0 peuvent continuer.
  Les niveaux, anciens dossiers, I4 et le verrou ENT sont testés.
- Le véritable gestionnaire de téléchargement refuse les UUID mal formés avant
  l'accès. Contrats UI/serveur, signatures de traduction et pièces sont testés.
- Aucun test réseau authentifié, charge réelle, antivirus réel, parcours privé
  sur téléphone/ordinateur ou contrôle d'identité nominatif dans ce passage.
  La recette Auth/MFA précédente attend toujours la configuration privée locale.
- La compilation, la barrière complète de sécurité, l'intégrité Spec Kit,
  les six tests de traduction, quinze de routage et quatre contrats responsive
  passent. L'avertissement de taille du module XLSX préexistant demeure.
  Ces résultats locaux ne valent pas preuve de configuration distante ou de RLS.
- Aucune migration, modification de compte, clé, production, DNS, VPS, Webmail,
  ENT/PRONOTE ou protection de partage. Publication limitée à la preview.

## Ordre Pratique

1. Livrer les correctifs de ce lot sur la preview et éprouver la reprise avec
   deux appareils fictifs et les identités des différents services.
2. Fermer provenance des résumés, quotas distribués, configuration MFA/adhésions
   et diffusion des documents personnels avant import réel ou ouverture élargie.
3. Vérifier sauvegarde/restauration, antivirus, charge, notifications et reprise
   réseau, puis faire valider responsabilités et conservation par l'établissement.
4. Ajouter le choix d'enfant lié et les améliorations de parcours au pilote.

T049 reste ouverte pour les limites ci-dessus, la protection des données et la
revue humaine. Aucun pourcentage global de sécurité ou de disponibilité annoncé.
