# Routage des demandes et notifications internes

## Règles

Une réponse directe de l'agent ne crée ni demande ni notification. Lorsqu'une
demande est confirmée, elle entre dans une file durable. Le superadministrateur
voit toutes les demandes de son établissement. Les rôles supplémentaires sont :

| Motif | Destinataires supplémentaires |
| --- | --- |
| ENT, ordinateur, activation | Référent numérique |
| Badge ou cantine | Administration, intendance |
| Absence ou retard élève | Administration, vie scolaire |
| Certificat, inscription, document | Administration, DDFPT |
| PFMP, stage, convention | DDFPT |
| Orientation | Administration, DDFPT |
| Emploi du temps, salle, cours | Administration, vie scolaire |
| Changement de coordonnées | Administration, DDFPT, référent numérique |

Une urgence alerte simultanément superadministration, DDFPT et administration.
Le tableau de bord, le push et l'email sont utilisés pour les services concernés.
Une seule notification est créée par destinataire, événement et canal. L'absence
d'une adresse sûre laisse le travail en échec visible ; aucun destinataire n'est
inventé.

Harcèlement, violence ou menace ne passent jamais dans cette file : le portail
oriente exclusivement vers SafeScol.

## Communications ciblées

L'auteur choisit explicitement l'audience et les canaux push, email ou SMS.
L'agent propose une ou plusieurs personnes, classes, niveaux ou tout
l'établissement ; l'auteur peut corriger. L'interface affiche le nombre de
destinataires, déduplique un contact partagé et indique le coût estimé. Les
parents ne sont pas ajoutés automatiquement aux changements de salle ou
d'absence. Le SMS reste limité aux destinataires choisis et aux usages autorisés.

## Variables serveur

- `SUPPORT_AGENT_EMAIL` : repli général et superadministration ;
- `SUPPORT_AGENT_EMAIL_DDFPT` : DDFPT ;
- `SUPPORT_AGENT_EMAIL_ADMINISTRATION` : administration ;
- `SUPPORT_AGENT_EMAIL_INTENDANCE` : intendance ;
- `SUPPORT_AGENT_EMAIL_VIE_SCOLAIRE` : vie scolaire ;
- `SUPPORT_AGENT_EMAIL_NUMERIQUE` : référent numérique ;
- `SUPPORT_AGENT_EMAIL_DIRECTION` : direction.

Les valeurs réelles restent hors de Git. Tous les rôles et destinataires sont
isolés par établissement.
