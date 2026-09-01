# Revue de l'adaptateur antivirus entrant

Date : 1er septembre 2026. Périmètre : préparation non raccordée, preview seule.

## Autorisation et exécution

Le propriétaire a autorisé cette mission Claude avec un plafond de 3 USD.
Une seule exécution Fable 5, effort élevé, a reçu quatre fichiers techniques :
adaptateur, tests, politique d'archives Office et politique de confirmation.
Aucun secret, contenu utilisateur, contexte d'un autre projet ou accès réseau.
Outils, MCP, personnalisations, sous-agents et persistance de session désactivés.

Coût déclaré par le CLI : **1,843302 USD**, dont 1,83062 pour Fable 5 et
0,012682 pour un auxiliaire automatique Haiku du CLI. Une réponse finale,
zéro sous-agent, aucune relance. Ce montant est la mesure du CLI, pas une
vérification de facture ni un pourcentage de l'abonnement.

Le rapport évoquait un fichier de plan et présentait du texte `ExitPlanMode`.
Ce texte n'est pas une commande autorisée ni une preuve de fichier créé. Aucun
patch de ce prétendu plan n'a été recherché ou exécuté : les corrections
ci-dessous ont été écrites par Codex après reproduction des comportements.

## Arbitrage

| Constat | Conclusion | Action et preuve |
| --- | --- | --- |
| Confirmation relue après validation | Confirmé en objet JavaScript à accesseurs. La gravité P1 proposée n'établit pas une attaque HTTP : du JSON ne fournit pas ces accesseurs. | Le parseur partagé copie chaque champ une seule fois, valide la copie et retourne uniquement ses champs connus. Un DOCX actif camouflé par un accesseur était accepté avant correction ; la régression refuse désormais l'archive. |
| `bytes` relu avant copie | Confirmé avec un accesseur interne substituant plus de 10 Mio après les contrôles. | Capture de la vue une seule fois, puis contrôle de la taille réelle de la copie avant empreinte et lancement. La régression échoue avant patch, passe après et ne lance aucun processus. |
| Champs symboliques propagés | Confirmé pour la copie par spread antérieure. | Le parseur retourne un objet indépendant sans champs symboliques ; test dédié. |
| Comparaison de clés par concaténation | Fragilité confirmée, sans exploitation publique démontrée. | Nombre exact de clés et présence propre de chaque champ. |
| Sortie propre en fragments, détection avec stderr | Tests manquants confirmés. | Réponse fragmentée acceptée ; détection avec avertissement refusée comme indisponible. |
| Texte d'un test prétendant prouver l'absence de suppression | Formulation trop large. | Test renommé : il contrôle le reçu et l'absence de signature brute, pas un stockage inexistant. |
| ClamAV réel, signatures et limites du démon | Non vérifiés par ce lot. | Maintien des prérequis d'activation et de T022 ouverte. |

Les deux nouvelles régressions d'accesseurs ont été exécutées avant les
correctifs et ont échoué par absence du refus attendu. Après correction,
les dix-sept tests ciblés passent. Le rapport de Claude seul n'aurait pas
constitué une preuve d'exécution.

Après correction : suites communications et sécurité de preview, compilation
TypeScript/Vite, intégrité des 89 migrations et des 549 tâches réussies.
L'audit des dépendances de production ne rapporte aucune alerte. Le warning
Vite antérieur sur le paquet XLSX volumineux reste inchangé. Aucun de ces
contrôles ne remplace la recette du véritable antivirus.

## Limites restantes

- Le module ne lit ni base, ni stockage, ni file. Le worker de promotion et sa
  transaction doivent encore être raccordés ; ce n'est pas un service actif.
- La preuve antivirus réelle exige le binaire déployé, la configuration du
  démon, les signatures récentes et des essais propre/EICAR/limites/chiffrement.
- Le contrôle Office local vise l'objet directement déclaré DOCX/XLSX/PPTX.
  Il ne parcourt pas les pièces Office imbriquées dans un email `message/rfc822`.
  Une extraction bornée vers des objets distincts sera nécessaire avant de
  prétendre appliquer la même politique à leurs pièces internes.
- La fin du client n'atteste pas l'arrêt immédiat du scan côté démon. Les
  limites serveur et la supervision des processus orphelins restent requises.
- L'environnement du processus est filtré, mais ce n'est pas un bac à sable
  système. Le service devra utiliser un compte isolé et des droits minimaux.
- Échec du nettoyage : refus fermé, sans garantie de suppression de toute
  copie du système. Aucun contenu utilisateur n'est écrit par l'adaptateur.

Sources ClamAV vérifiées dans la note d'exploitation de quarantaine. Aucun
déploiement de worker, changement de VPS, migration ou service réel ici.
