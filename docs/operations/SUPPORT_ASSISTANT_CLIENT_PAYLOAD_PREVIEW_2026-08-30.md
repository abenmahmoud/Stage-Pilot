# Validation navigateur des réponses de l'assistant - preview

## Comportement livré

- La réponse de l'assistant est lue comme une donnée inconnue puis validée avant
  son affichage ou la conservation de son reçu de routage.
- Catégorie, profil, urgence, confiance, périmètre, action et compteurs doivent
  appartenir aux vocabulaires fermés du produit.
- Les textes, listes et références de sources sont bornés ; chaque date doit
  être valide.
- Le reçu de routage doit être absent avec son échéance, ou être signé, borné et
  expirer dans la fenêtre prévue de quinze minutes.
- Toute réponse incohérente déclenche l'analyse locale déterministe sans bloquer
  l'usager.

## Vérifications

- Le test statique dédié est inclus dans la barrière de sécurité permanente.
- La recette Chromium injecte une catégorie inconnue et une fausse instruction
  de transfert humain.
- À 320 x 720 et 1440 x 1000, la réponse injectée n'est jamais affichée ; le
  repli local classe correctement le besoin dans `ENT ou EduConnect`.
- Aucun débordement horizontal, erreur JavaScript, donnée réelle ou appel à un
  modèle externe n'a été observé.

## Limites

- Cette validation protège le navigateur contre une réponse réseau malformée ;
  elle ne remplace pas la vérification cryptographique du reçu côté serveur au
  moment de créer ou de router une demande.
- Lot de preview uniquement : aucune production ni intégration distante n'a été
  modifiée.
