# Outils du distanciel et secours ENT — 7 octobre 2026

## Mise en place

La page `/?view=continuity` conserve la consigne validée : cours à distance à
partir du jeudi 8 octobre. Deux parcours présentent les outils aux élèves et
parents, puis aux professeurs. Les familles choisissent entre connexion
habituelle, ENT inaccessible et connexion limitée.

Les professeurs disposent des guides officiels Classe Virtuelle, Nuage pour
partager les supports en lecture seule et recevoir des devoirs séparément,
ainsi que Tubes en option. Les liens des séances et des dossiers doivent être
créés par les enseignants, testés et transmis aux destinataires concernés.
La page ne crée pas de salle, ne publie pas de lien privé et ne provisionne
aucun compte externe.

Blaise répond directement aux questions de panne de l’ENT avec les moyens de
poursuivre les cours. Une récupération de mot de passe et une panne matérielle
conservent leurs parcours. L’accès direct à PRONOTE reste une option réservée
à l’administration, avec la procédure Index Éducation et des identifiants
propres ; aucun accès alternatif au lycée n’est annoncé comme activé.

## Sources

- Classe Virtuelle : https://eduscol.education.gouv.fr/4914/le-service-classe-virtuelle-sur-la-plateforme-appseducationfr
- Guide officiel du 2 octobre 2026 : https://eduscol.education.gouv.fr/sites/default/files/document/appspas-pas-v7pdf-94524.pdf
- Nuage, partage : https://monaidenumerique.education.gouv.fr/tutoriels/nuage/partage/
- Nuage, dépôt : https://monaidenumerique.education.gouv.fr/tutoriels/nuage/dropbox/
- Tubes : https://monaidenumerique.education.gouv.fr/outils/tubes/accueil/
- PRONOTE : https://docs.index-education.com/docs_fr/fr-pronote-support-fiche-371-4911-comment-permettre-l-acces-a-pronote-sans-passer-par-l-ent.php

## Vérifications

Build TypeScript/Vite réussi. Tests du guide de navigation et de continuité
réussis ; test ciblé `scripts/test-school-continuity-tools.mjs` réussi.
Le navigateur contrôle les trois situations, les guides professeurs,
l’absence de débordement à 390 et 1440 px et l’absence d’erreur JavaScript.
Les contrôles de publication sont conservés hors Git dans
`outputs/continuite-secours-ent-2026-10-07`.

## Suite opérationnelle

Tester une classe pilote avec un vrai lien participant, la salle d’attente,
un support et une remise de devoir. Conserver les liens privés hors de la page
publique. Aucun email, SMS ou push envoyé par cette livraison.
