# Validation du chargement de la console Communications

## Périmètre

La console privée Communications traite désormais comme inconnues les réponses
initiales de quatre routes : communications, modèles, envois en échec et réponses
entrantes. Les quatre contrats sont validés avec le contrat documentaire avant
le premier remplacement d'état React.

Une réponse invalide ferme tout le chargement et conserve l'état visible
précédent. Aucun résultat partiel n'est présenté comme fiable.

## Contrôles

- cent communications, échecs ou entrants au plus, avec identifiants uniques et
  tri serveur décroissant vérifié ;
- statuts, visibilité, catégories, versions, dates, slugs, modèles et relations
  de publication cohérents ;
- faits structurés et questions bornés avec leurs cinq groupes exacts ;
- six modèles officiels présents une seule fois ; un modèle non personnalisé
  doit correspondre exactement au catalogue versionné ;
- personnalisations liées à un UUID, une version et une date valides ;
- échecs limités aux travaux d'envoi et de reprise ;
- réponses entrantes bornées, avec classement connu et titre uniquement quand
  une communication est réellement rattachée ;
- rejet des secrets dans tous les textes affichés.

## Frontières

Ce lot n'active aucun envoi, entrant, document, publication ou destinataire. Il
n'ajoute ni migration, ni variable, ni service distant, ni donnée réelle. Les
interrupteurs existants restent fermés et T027 demeure ouvert pour la recette
réseau entre applications avec contacts fictifs.

## Vérification

```powershell
npm run test:communication-admin-payload
npm run test:communications
npm run test:preview-security-gate
npm run build
```
