# Hebdo : récupération Gmail et préparation éditoriale

## Demande et source confirmées
Adel souhaite récupérer automatiquement l’hebdo envoyé en fin de semaine par la proviseure, corriger sa présentation et proposer les mises à jour du site et de l’agent. La boîte indiquée a été confirmée par le profil du connecteur Gmail. L’adresse personnelle, les identifiants de messages et les sources sont conservés hors Git dans `../Hebdos_lycee/`.

Les hebdos des 7 et 14 septembre sont retrouvés, envoyés par l’adresse officielle `ce.0932048w@ac-creteil.fr`. L’hebdo du 14 au 18 septembre est reçu le vendredi 11 septembre à 17 h 47. Les résultats SPF, DKIM et DMARC ajoutés par Gmail sont positifs. Chaque nouveau message reste à vérifier.

## Opérationnel dans Codex
- Automatisation de ce fil : `pr-parer-l-hebdo-du-lyc-e`, active, vendredi 18 h 30 (Europe/Paris).
- Recherche ciblée, lecture du courrier utile et des PDF, dédoublonnage, préparation éditoriale et dépôt de brouillons dans le site. Aucun envoi ni publication automatique.
- Huit propositions pour le 14 au 18 septembre, au plus trois mises à la une, avec source, expiration et note de relecture : `../Hebdos_lycee/hebdo-2026-09-14.brouillons.json` et `HEBDO_2026-09-14_APERCU.html`.
- Protocole et état de traitement dans `../Hebdos_lycee/PROTOCOLE.md` et `suivi.json`. Les listes de destinataires ne sont pas conservées dans les livrables.
- PDF original lu intégralement : deux pages réelles, dont une page blanche. Rendu vérifié ; l’extraction inline Gmail annonçait une page et était incomplète.
- Aperçu vérifié avec Chromium en 1280 et 390 px : huit propositions, aucun débordement horizontal. Captures relues.
- Huit brouillons insérés dans `site_content_items`, chacun avec une version initiale et un audit (source, empreinte, note de relecture). Identité d’acteur système non attribuée à un humain. Tous les champs de publication et d’approbation restent nuls.
- Deux rejeux vérifiés, dont un avec le générateur réutilisable `../Hebdos_lycee/prepare-import.mjs` : zéro ligne supplémentaire. L’API publique ne renvoie pas le brouillon contrôlé ; l’administration sans authentification répond 401. Les brouillons sont disponibles dans `/admin/contenus`.
- Contrôles du dépôt réussis : `npm run build`, `npm run test:preview-security-gate` et `npm run test:spec-integrity`. Aucune modification du code applicatif ni des règles d’accès dans ce lot.

## Limites et suite nécessaire
Ce suivi dépend de l’environnement Codex/Gmail ; il n’est pas un connecteur serveur permanent du portail. La prochaine exécution planifiée n’a pas encore eu lieu ; la chaîne a été exécutée et contrôlée sur le premier lot réel.

L’absence de `xijocumlwivhbmffrnlj` dans `list_projects` et son échec avec `get_project` avaient fait suspecter à tort un défaut d’accès. `list_branches` du parent `sfqhxiamhgsbbogluqtq` retrouve la branche `guichet-lycee-preview`, et `execute_sql` fonctionne avec sa référence exacte. Aucun nouveau secret, rôle ou changement d’accès n’a été nécessaire. Règle de reprise : vérifier les branches avant de conclure à un blocage d’accès.

L’atelier `/admin/hebdo` existe dans le code pour un import PDF manuel et une création de brouillons après relecture. Son ouverture générale et l’archivage serveur privé restent distincts du suivi Codex désormais configuré. Le dépôt en brouillons emprunte les tables/versionnements/audits existants et ne modifie pas les données publiées.

La publication, la mise à jour de la connaissance de l’agent et les notifications restent soumises aux validations humaines déjà décidées. Le calendrier définitif annoncé ne prouve pas que le chat sait fournir les emplois du temps individuels. Le chantier EDT reste en pause.

Point de correction concret : l’hebdo annonce la rencontre des parents de seconde le 22 septembre à 17 h 30. `shared/school-public-information.ts` conserve « L’horaire n’est pas encore communiqué. ». La correction est proposée dans le sixième brouillon, sans remplacement du contenu public avant validation.
