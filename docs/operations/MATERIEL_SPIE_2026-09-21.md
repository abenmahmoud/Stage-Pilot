# Espace Matériel du lycée et passages SPIE — 21 septembre 2026

## Besoin

Les professeurs doivent pouvoir signaler un problème sur un équipement du
lycée, suivre le dossier et connaître les dates confirmées de passage du
technicien SPIE. Le référent numérique qualifie et coordonne ; il n’est pas
présenté comme le réparateur.

## Parcours livré

- `/materiel` : fiche guidée responsive, prochain passage publié, dossiers de
  l’appareil et lien vers `Mes demandes` pour les réponses et photos ;
- la création réutilise `support_requests`, catégorie `ordinateur`, service
  `referent_numerique`, historique et notifications déjà en place ;
- données structurées : matériel, salle, inventaire facultatif, constat,
  impact, risque, disponibilités et passage souhaité ;
- `/gestion/materiel` : compteurs, incidents structurés, rappel de la limite du
  rôle, calendrier SPIE, brouillon, publication, modification, annulation et
  clôture d’un passage ;
- la file `/gestion/demandes` reste l’endroit unique pour répondre, joindre,
  attribuer et résoudre le dossier.
- le DDFPT accède à la coordination et aux dossiers `ordinateur` du service
  numérique depuis son compte ; cette coopération ne lui ouvre pas, par cette
  règle, les demandes ENT, codes ou messagerie du référent ;
- le coordinateur affecte explicitement les dossiers à un passage puis crée un
  lien `/intervention-spie/<id>` et un code à 8 chiffres affiché une seule fois ;
- le portail SPIE expose seulement les informations techniques utiles, sans
  nom, email, téléphone, description libre complète ni pièce jointe ;
- SPIE dépose un diagnostic ou un résultat. Celui-ci devient une note interne
  tracée ; le lycée garde la validation et la clôture du dossier.

Le SAV des ordinateurs individuels de la Région reste sur
`/assistance-numerique`. Une passerelle visible oriente les enseignants vers le
nouvel espace sans mélanger les deux responsabilités.

## Sécurité et données

Les tables `equipment_service_visits`, `equipment_service_visit_events`,
`equipment_service_visit_requests`, `equipment_external_access_grants` et
`equipment_external_updates` ont RLS activée et forcée. `anon` et
`authenticated` n’ont aucun privilège direct ; les API serveur contrôlent le
périmètre `referent_numerique` ou le droit global. L’API publique restitue
uniquement les passages confirmés futurs et exclut les notes internes.

Les accès SPIE utilisent un code HMAC non conservé en clair, cinq essais au
maximum, une session HTTP-only SameSite Strict de huit heures au plus, une
expiration configurable et une révocation immédiate. Un nouvel accès révoque
l’accès actif précédent du même passage. Chaque compte rendu est idempotent et
journalisé dans le dossier, sans permettre au prestataire de répondre au
demandeur ou de clore lui-même la demande.

La migration a été appliquée à la branche Supabase
`guichet-lycee-preview` (`xijocumlwivhbmffrnlj`). Contrôle SQL : RLS activée et
forcée sur les deux tables, aucun SELECT pour `anon`/`authenticated`, accès
`service_role`, insertion fictive dans une transaction puis rollback, zéro
ligne résiduelle. L’advisor a signalé l’index de portée manquant sur l’audit ;
il a été ajouté et l’alerte correspondante a disparu. L’information générale
« RLS activée sans policy » est attendue pour ces tables serveur fermées : les
privilèges publics sont retirés et aucune policy d’accès client n’est voulue.

## Recette

- build TypeScript et Vite réussi ;
- tests de politique matériel, routage support, détail public, intégrité des
  migrations, limites de méthodes, authentification des routes et couverture
  RLS réussis ;
- Chromium local avec API fictives : 1440 × 1000 et 390 × 844, aucune erreur
  console, aucun débordement horizontal ;
- création complète d’un dossier fictif jusqu’à l’écran
  `Dossier BC-2026-004301`, sans écriture distante ;
- captures et script hors Git dans `../QA_MATERIEL_SPIE_2026-09-21/`.

## Activation et suite réelle

La coordination DDFPT et le portail SPIE ont été préparés sur la branche de
preview. Le compte de Christophe Pourchet est actif et possède déjà les
services nécessaires dans l’établissement. Aucun créneau réel ni accès SPIE
n’a été créé pendant la recette : le public verra « Date en attente de
confirmation » tant qu’un coordinateur n’aura pas publié une date communiquée
par SPIE. Le premier passage réel doit encore être saisi, ses dossiers
sélectionnés et son lien transmis avant de clore T055A.
