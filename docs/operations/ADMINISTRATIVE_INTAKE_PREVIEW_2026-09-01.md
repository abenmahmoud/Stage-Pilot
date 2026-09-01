# Démarches administratives dans le guichet unique

## État

Lot de preview livré le 1er septembre 2026. Il n'ajoute ni donnée réelle, ni
notification réelle, ni route de création parallèle.

## Parcours

L'usager peut écrire librement ou choisir le formulaire classique. Les besoins
suivants sont compris et présentés :

- inscription ou réinscription ;
- certificat, document ou pièce manquante ;
- bourse ou intendance ;
- absence, retard ou justificatif ;
- restauration ou internat ;
- orientation ou formation ;
- rendez-vous ;
- autre demande administrative.

L'envoi passe toujours par `/api/support/requests`. Il conserve le même numéro
public, le suivi sur appareil, la conversation, le contact et le pipeline privé
des pièces jointes.

## Routage prudent

- inscription, certificat, document et orientation : secrétariat ;
- bourse et restauration : intendance ;
- absence, retard et justificatif : vie scolaire ;
- internat sans responsable local validé : administration, confiance moyenne ;
- rendez-vous sans destinataire certain : administration, confiance moyenne ;
- mention explicite de la vie scolaire, de la direction ou du numérique : file
  spécialisée déjà définie par la politique de routage.

Un rendez-vous ne reçoit jamais une priorité urgente par défaut. L'agent humain
peut corriger le service, prendre en charge, répondre et clôturer dans le dossier
existant.

## Preuves locales

- `npm run test:support-routing`
- `npm run build`
- `npm run test:spec-integrity`
- `npm run test:preview-security-gate`
