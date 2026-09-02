# Preuve réseau LyceeGest vers faux Webmail

## Périmètre

- Date : 2 septembre 2026.
- SHA LyceeGest testé : `6152f7cbdcf3a9a5f38e3246cec34103febb78c9`.
- Run : `webmail-network-20260902-23db3a8fbf64`.
- Équipe Vercel : `safe-scol`.
- Région : `cdg1`.
- Données : références opaques entièrement fictives.

La cible était un projet jetable séparé du projet LyceeGest, du vrai Webmail et
de toute base métier. Deux routes POST seulement étaient déployées : challenge
HMAC et livraison de commande signée. Aucun appel Brevo, Gmail, Supabase,
Webmail réel ou autre fournisseur n'était présent dans la fixture.

## Garde-fous vérifiés

- Projet exact : `lyceegest-webmail-fixture-22b6d6756d`.
- Déploiement fixture : `dpl_BisowiAbDy3awp4k5rdS7pwRpoHW`.
- Cible : `target=null`, donc aucune promotion.
- Hôte conforme au motif réservé des fixtures Vercel.
- Cinq secrets aléatoires, distincts et éphémères; aucune valeur conservée.
- Challenge signé lié au run et à une expiration bornée avant le premier envoi.
- Bearer, commande et reçu vérifiés avec des secrets distincts.
- Redirections interdites, réponses JSON bornées et délai de dix secondes.

Vercel classe le premier déploiement d'un projet neuf comme production. Une
amorce HTML vide `dpl_DQt1wy54srP1ePuUZbei7yYufN3v`, sans fonction ni secret,
est donc restée sous SSO pendant le build de la preview. Elle a été supprimée et
son absence vérifiée avant la désactivation du SSO de la fixture et avant tout
appel de recette.

## Résultat

```json
{
  "target": "isolated_webmail_fixture",
  "runId": "webmail-network-20260902-23db3a8fbf64",
  "accepted": 200,
  "duplicates": 20,
  "contacts": "opaque_fictitious_only"
}
```

Les 200 premières décisions sont des succès non doublons avec 200 références
fournisseur hachées distinctes. Les 20 rejeux d'états déjà livrés sont reconnus
comme doublons. La sérialisation des 220 résultats ne contient aucun marqueur
d'adresse, destinataire, audience, copie, Gmail ou domaine académique.

## Nettoyage

- Amorce vide supprimée avant l'ouverture de la fixture : confirmé.
- Projet temporaire `prj_dLMMfPatF70oscQyBefodI1HfHWu` supprimé : confirmé.
- Cinq secrets supprimés avec le projet : confirmé.
- Inventaire Vercel après retrait : zéro projet `lyceegest-webmail-fixture-*`.
- Ancienne URL : plus de lien partageable ou de déploiement récupérable.
- Dossier local temporaire et ses variables éphémères supprimés : confirmé.
- Persistance métier, fichier, email et notification : aucun.

Cette preuve ferme la recette réseau fictive de `005/T027` et `005/T032`. Elle
ne prouve pas un envoi réel, un fournisseur réel, une liste réelle, un pilote
humain, un lecteur d'écran ou la production.
