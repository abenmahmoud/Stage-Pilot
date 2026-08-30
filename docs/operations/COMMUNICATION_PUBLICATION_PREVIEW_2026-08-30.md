# Publication des communications dans la preview

## État livré

Le parcours technique comporte désormais quatre états distincts : brouillon,
relecture, validation direction et publication. La publication crée dans une
transaction unique un article `site_content_items`, sa version publique, le
rattachement à la communication et les deux journaux d'audit.

La route privée exige :

- un compte superadmin ou proviseur sous MFA ;
- le module communications actif côté environnement et base ;
- la publication active côté environnement et base ;
- une communication publique et une version courante approuvée ;
- la confirmation exacte `PUBLIER` ;
- aucune question ouverte, coordonnée, secret ou dépassement des limites du site.

## Interrupteurs

Les trois valeurs suivantes restent fermées dans ce lot :

- `COMMUNICATION_PUBLICATION_ENABLED` ;
- `VITE_COMMUNICATION_PUBLICATION_ENABLED` ;
- `communication_settings.publication_enabled`.

Le code déployé ne constitue donc pas une activation.

## Recette future

Sur une base de preview isolée et avec un compte fictif sous MFA :

1. activer temporairement les trois interrupteurs ;
2. créer un brouillon fictif sans coordonnée ;
3. choisir `Site public`, demander la relecture puis valider ;
4. publier et vérifier une seule page dans `À la une` ;
5. rejouer la confirmation et vérifier l'absence de doublon ;
6. tenter secret, email, téléphone, version interne et question ouverte ;
7. supprimer les données fictives et refermer les interrupteurs.

Aucune donnée réelle, aucun destinataire et aucun envoi Brevo ne participent à
cette recette.
