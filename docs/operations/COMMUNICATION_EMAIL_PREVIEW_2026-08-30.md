# Aperçu email des communications - 30 août 2026

## Résultat

L'éditeur privé propose maintenant trois modes stables : `Écrire`, `Page` et
`Email`. L'aperçu email est construit localement à partir du même titre, résumé
et corps Markdown que la version éditoriale. Il n'appelle aucune API et ne
connaît aucun destinataire.

Le modèle commun est `shared/communication-email-preview.ts`. Il fixe :

- le nom d'expéditeur institutionnel, sans adresse technique ;
- l'objet et le pré-en-tête bornés ;
- le corps Markdown déjà contrôlé ;
- le lien canonique en attente de publication ;
- l'envoi à `false` de manière constante.

## Rendu de contrôle

L'écran montre les champs `De`, `À` et `Objet`, puis le corps dans une largeur
proche d'un client email. `À` affiche toujours `Aucun destinataire sélectionné`.
Le futur lien vers la version officielle est annoncé mais n'est ni inventé ni
cliquable avant publication.

Les images distantes restent neutralisées. Les liens relatifs et HTTPS sans
identifiants sont isolés dans un nouvel onglet ; `http`, `mailto`, `javascript:`,
les URL avec identifiants et les valeurs invalides deviennent du texte non
cliquable. Les tableaux peuvent défiler dans leur propre zone sans agrandir la
page sur téléphone.

## Frontière de sécurité

- Aucun email, téléphone, contact, groupe ou identifiant fournisseur n'entre
  dans le modèle.
- Le modèle refuse les champs inconnus et les contenus hors limites.
- L'aperçu ne vaut ni validation, ni publication, ni autorisation d'envoi.
- Les interrupteurs de publication et d'envoi restent absents du navigateur.
- Le rendu futur utilisé par le worker devra réutiliser ce modèle ou démontrer
  par test qu'il produit exactement les mêmes éléments éditoriaux.

## Vérifications

- modèle, valeurs par défaut et pré-en-tête sans destination Markdown ;
- refus des champs de destinataire et des tailles excessives ;
- politique des liens sûrs ;
- trois modes accessibles dans l'éditeur et mise en page bornée ;
- absence de route ou commande d'envoi ;
- suite Communications et build de production.

Aucun environnement, base, service externe ou donnée réelle n'est modifié par
ce lot.
