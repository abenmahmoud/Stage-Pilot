# Plan - Centre de communication du lycée

## Architecture proportionnée

Le module complète l'espace de contenus existant sans créer un nouveau site :

- **LyceeGest** conserve le brouillon, les versions, l'approbation, la page
  officielle et les états de diffusion.
- **Webmail du Lycée** reste la référence des contacts validés et le service de
  diffusion. Une API serveur limitée permettra de cibler des groupes sans
  transmettre la liste au navigateur.
- **Brevo** effectue les envois individuels et remonte les événements de
  délivrabilité. Son service d'analyse entrante pourra recevoir les réponses et
  les emails transférés sur un sous-domaine distinct.
- **Le site public** lit uniquement la version publiée via l'API existante.

## Modèle de données additif

- `communications` : contenu lié, source, visibilité, état, calendrier et
  validateur.
- `communication_audiences` : groupes ciblés, sans liste d'adresses en clair.
- `communication_deliveries` : référence du contact, canal, état, tentative et
  identifiant fournisseur.
- `communication_inbound` : identifiant du message, source, état d'analyse et
  brouillon créé.
- `communication_jobs` : travail durable de publication, envoi, reprise ou
  génération de récapitulatif.
- `communication_events` : audit fonctionnel sans corps complet ni adresse en
  clair.

Les contenus publics continuent d'utiliser `site_content_items`, ses versions et
ses fichiers. Une communication interne ne reçoit jamais de version publique.

## Automatisation

1. La source est enregistrée avant analyse.
2. Le texte est extrait localement, contrôlé puis pseudonymisé.
3. L'aide IA produit une proposition structurée et des points à vérifier.
4. La validation crée une version officielle et un travail durable.
5. Le worker résout les contacts côté serveur puis envoie individuellement.
6. Les webhooks mettent à jour les livraisons de manière idempotente.
7. Les réponses rejoignent la boîte de traitement de la communication.

## Interface simplifiée

L'écran principal propose trois commandes visibles :

1. `Nouvelle communication`
2. `À valider`
3. `Envois et réponses`

Le parcours de création reste en trois étapes : `Déposer`, `Vérifier`,
`Publier et informer`. Les réglages avancés restent repliés.

## Autorisations retenues pour le pilote

| Action | Administration | Proviseur | Superadmin |
| --- | --- | --- | --- |
| Déposer et corriger un brouillon | Oui | Oui | Oui |
| Demander une validation | Oui | Oui | Oui |
| Rendre public | Non | Oui | Oui |
| Choisir une audience réelle | Non | Oui | Oui |
| Programmer ou lancer un envoi | Non | Oui | Oui |
| Reprendre un envoi en erreur | Non | Oui | Oui |

Ces droits reprennent ceux du module de contenus existant. Aucun code direction
partagé ne remplace les comptes nominatifs et le MFA prévus pour la production.

## Déploiement

1. Migrations additives sur la branche Supabase de preview uniquement.
2. Simulation avec contacts fictifs et domaine d'envoi de test.
3. Vérification téléphone, ordinateur, accessibilité et charge.
4. Pilote avec un petit groupe autorisé.
5. Activation de la collecte email et des listes réelles sur ordre explicite.
6. Aucun changement DNS, Hostinger, VPS ou envoi de masse dans ce lot.

## Retour arrière

- L'interrupteur `COMMUNICATIONS_ENABLED` masque le module sans retirer les
  contenus existants.
- L'interrupteur `COMMUNICATION_SEND_ENABLED` interdit tout envoi réel.
- Une publication peut être archivée sans supprimer sa version.
- Une campagne en attente peut être annulée ; un email déjà remis ne peut pas
  être rappelé et sa correction passe par une nouvelle version officielle.
