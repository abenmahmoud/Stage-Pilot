# Persistance des pannes de communication - 30 août 2026

## Transaction

`persistCommunicationJobFailure` verrouille le travail et sa livraison, applique
la politique de panne, puis écrit dans la transaction fournie par le runner.

- panne temporaire : statut `retry` avec échéance calculée ;
- panne permanente ou plafond : statut `dead` et boîte d'échec ;
- livraison pré-envoi : statut `error` ;
- livraison déjà envoyée ou plus avancée : état inchangé ;
- audit : code fermé, essai et échéance uniquement.

Le travail n'est modifié que s'il est encore `running` avec le même compteur
d'essais. La livraison n'est modifiée que si son état verrouillé est toujours le
même. Tout conflit annule la transaction appelante.

## Limites

La reprise manuelle persistée, la boîte d'échec et le runner restent à relier.
Aucune erreur fournisseur brute, adresse ou donnée distante n'est traitée ici.
