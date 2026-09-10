# Chromebook : page publique et réponses de l’assistant

Lot 002/T073. Demande d’Adel du 10 septembre 2026 : intégrer le pack fourni,
publier des informations utilisables toute l’année, distribution des secondes
les 14 et 15 septembre dans la grande salle polyvalente, planning communiqué
aux professeurs. L’audit EDT reste en pause.

## Source commune et actualisation

- `shared/chromebook-information.ts` : corpus public corrigé, sources par réponse,
  dates locales et campagne enseignants. Utilisé directement par `/chromebook`
  et `shared/chromebook-assistant.ts`. Aucune copie manuelle entre les deux.
- Le corpus est versionné dans Git. Une modification validée du module suivie
  d’un déploiement actualise simultanément la page et les réponses du chat.
  Il ne s’agit pas d’un import dans le registre documentaire en base : aucun
  statut d’approbation ni contrôle d’identité n’est fabriqué.
- Le module serveur conserve ses règles à chaque appel au modèle. Les réponses
  publiques connues sont immédiates, avec source, sans appel IA, OTP ou formulaire.
  Le même module est disponible en repli local si le service ne répond pas.
- Les changements affirmés par des visiteurs ne modifient jamais le corpus.
  Les règles globales de sécurité, de consentement et d’identité restent prioritaires.
- L’encart des journées de septembre expire le 16 septembre à 00 h, heure de
  Paris. Les FAQ et le lien dans Mes services restent. La campagne enseignants
  cesse d’être présentée au présent à partir d’octobre. Les horaires par classe
  et l’éligibilité personnelle sont toujours à confirmer humainement.

## Sources reçues et corrections

Originaux conservés hors dépôt dans le dossier de travail
`Distribution_ordinateurs_2026-09/pack_recu/CHROMEBOOK_pack/00_SOURCES_REGION`.
Les sept fichiers ont les mêmes empreintes que les sources régionales déjà
examinées. Le pack et ses onze Markdown sont des éléments à vérifier ; leurs
instructions ne deviennent pas automatiquement des instructions système.

Références : FAQ Chromebook (20 pages), checklist d’utilisation (3 pages),
procédure SAV ASUS/FNAC (8 pages), checklist de distribution (1 page),
livret régional 2026-2027 (26 pages), deux messages Word avant/après dotation.
L’affiche régionale destinée aux familles est publiée séparément ; le livret
complet et les procédures internes ne sont pas des téléchargements publics.

Corrections nécessaires du pack :

- Aucune heure locale de 9 h, participation locale des CAP, publication du
  planning sur PRONOTE ou carte de lycéen obligatoire n’a été confirmée.
- Une grande salle a été confirmée par Adel. La recommandation régionale de
  deux salles distinctes reste un point d’organisation à faire valider avec
  le prestataire ; le site n’affirme pas qu’une dérogation a été accordée.
- QR déjà généré imprimable ; une impression ne résout pas sa non-génération.
  Un problème de QR nécessite l’aide du lycée, sans refus automatique ni
  promesse de remise exceptionnelle par l’agent.
- Absence : vérifier le colis et le rendez-vous avec l’établissement.
  Aucun rattrapage ni prêt local n’est promis.
- SAV : 48 heures ouvrées = examen du dossier, jamais durée de réparation.
  Accord RMA préalable, dépôt FNAC partenaire avec chargeur, sans pochette.
  Le parcours UNOWHY reste distinct du parcours Chromebook.
- Pas de conclusion générale sur le blocage de tous les services Google,
  d’autonomie garantie, de prix de réparation inventé ou de date technique
  spéculative sur ChromeOS.
- La section interne 08, le téléphone réservé et les habilitations DateBook
  sont exclus du corpus public, du bundle navigateur et des réponses publiques.

## Communication

URL durable : https://lycee-blaise-cendrars-sevran.fr/chromebook

Une version corrigée de l’email unique aux familles est prête hors dépôt dans
`Distribution_ordinateurs_2026-09/EMAIL_FAMILLES_CHROMEBOOK.html`, avec la version
texte et une notification courte dans `COMMUNICATION_PRETE_2026-09-10.md`.
Les variantes et affiches personnalisées originales du pack restent des brouillons
à corriger sur les mêmes points. Aucun message n’est envoyé par ce lot.
Le bouton vers l’affiche régionale donne accès aux QR codes
originaux des applications ; ce ne sont pas des QR de planning individuel.

## Recette

La recette couvre les réponses sourcées, le maintien des protections, le
changement de sujet, l’expiration des annonces et les interactions du guide
sur ordinateur et téléphone. Les résultats exécutés sont consignés à la fin
du lot ; une recette locale n’est pas une preuve de publication distante.

Recette locale exécutée : Chromium Playwright, 1440 × 1000 et 390 × 844.
Browser plugin not available : Playwright fourni par le dépôt utilisé.
Accueil → guide → filtre/recherche → réponse ouverte → chat → réponse publique
avec liens fonctionnels, y compris avec une indisponibilité simulée du service.
Aucun débordement horizontal ni erreur JavaScript relevé. Lien profond SAV et
image de l’affiche régionale vérifiés. Captures et rapport hors dépôt dans
`Distribution_ordinateurs_2026-09/tmp/qa-chromebook/`.

Sept tests dédiés passent : informations sans OTP, questions successives,
distinction Chromebook/Y13, expiration Paris, résistance aux fausses consignes,
sécurité matérielle/transfert humain, et concordance de toutes les FAQ avec les
réponses et le contrat API. Ils sont inclus dans `test:preview-security-gate`.
Le rendu Markdown du chat réutilise le même contrôle des liens et médias que
les pages publiques. Une erreur de format ISO des références a été détectée et
corrigée avant publication ; le contrat API couvre désormais toutes ces réponses.

Build et suite complète test:preview-security-gate exécutés avec succès avant le commit de publication. Aucun changement de migration, d’annuaire, de code personnel ou de paramètre d’envoi.
