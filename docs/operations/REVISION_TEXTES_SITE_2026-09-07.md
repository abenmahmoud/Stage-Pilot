# Révision des textes du portail — 7 septembre 2026

État : corrections développées et vérifiées localement, à intégrer au travail de Claude avant publication. Ce document ne certifie pas le fonctionnement complet du service en production.

Branche : `codex/correction-textes-lycee-20260907`, issue de `cd512c4` sur `codex/lycee-connect-prototype`. Le dossier principal utilisé par Claude n’a pas été modifié. Aucun dossier réel, compte, email ou document privé n’a été créé, changé ou envoyé pour ces essais.

## Corrections réalisées

- Accueil, services, aide, formulaire, confirmation, suivi et espace agent : français corrigé, vouvoiement, libellés plus directs, distinction entre préparation et envoi d’une demande. Suppression des annonces trompeuses « services ouverts », « aide immédiate » et « application complète ».
- Cantine : accès visible « Cantine et intendance » sur l’accueil et dans les services, avec une question préremplie. Les identifiants de catégories et les règles serveur de routage ne changent pas dans ce lot.
- Informations pratiques : coordonnées communes au pied de page, à la connexion et à la page lycée ; accueil sur rendez-vous et bouton pour en demander un. L’ancien numéro de bus non vérifié est remplacé par le calcul d’itinéraire d’Île-de-France Mobilités. Texte des coordonnées agrandi sur mobile.
- Rencontre des parents de seconde : mardi 22 septembre 2026, au lycée, présentation du lycée et de l’ENT. Aucune heure inventée. L’encart cesse de s’afficher après cette journée, à minuit heure de Paris, y compris dans un onglet resté ouvert.
- Connexion : présentation adaptée à l’équipe du lycée, année 2026-2027 et consignes plus claires. Tableaux de gestion et livret imprimable : retrait de l’année 2025-2026 figée, sans redater les dossiers archivés.
- Livret de stage et Grand Oral : accents et consignes corrigés ; noms techniques et données conservés.
- Confidentialité : distinction entre email vérifié et identité confirmée ; demande de modification des coordonnées soumise au lycée ; rappel de ne pas écrire de codes dans la conversation. La mention existante de phase pilote demeure, faute de preuve de validation institutionnelle de son retrait.

## Sources et décisions

| Information | Source utilisée | Traitement |
| --- | --- | --- |
| Adresse, téléphone et email académique du lycée | Livret d’accueil 2026-2027, page 1, recoupé avec la [fiche Onisep](https://www.onisep.fr/ressources/structures-enseignement/ile-de-france/seine-saint-denis/lycee-polyvalent-blaise-cendrars) consultée le 7 septembre | Coordonnées regroupées dans `shared/school-public-information.ts` |
| Accueil sur rendez-vous | Réponse explicite d’Adel dans la préparation du 4 septembre | Affichage public et démarche de demande de rendez-vous |
| Rencontre des parents de seconde du 22 septembre | Réponses explicites d’Adel et politique opérationnelle 2026-2027 déjà enregistrée | Encart daté, sans heure de rencontre, avec expiration |
| Cantine gérée par l’intendance | Correction explicite d’Adel lors du test d’une demande | Libellés et accès au formulaire |
| Parcours de formation | Fiche Onisep précitée et [page des spécialités du lycée](https://lycee-blaise-cendrars-sevran.fr/specialites/) | Libellés clarifiés ; aucun nouveau parcours annoncé |
| Transports | [Île-de-France Mobilités](https://www.iledefrance-mobilites.fr/) | Renvoi aux itinéraires et horaires actuels |

Ces faits éditoriaux ne deviennent **pas** automatiquement une source publiée de l’assistant. Leur import dans le registre de connaissances doit suivre le circuit de validation existant. Le livret privé n’est pas embarqué dans le site.

## Informations restant à confirmer, une question à la fois

1. Intendance : procédure actuelle d’inscription à la cantine, réservation, tarifs et paiement. Le livret mentionne une procédure par empreintes, tandis qu’Adel décrit des badges. Ne pas reprendre ces modalités ni les horaires du livret sans arbitrage.
2. Administration : horaires d’accueil des différents services et heure de la rencontre du 22 septembre. Garder « sur rendez-vous » et « horaire non communiqué » entre-temps.
3. Vie scolaire, CDI et EPS : documents annuels à diffuser, horaires et activités à jour. Les consignes internes du livret ne sont pas toutes destinées aux familles.
4. Direction : avis de confidentialité définitif et validation de l’usage réel du portail. Ne pas annoncer une conformité ou une validation non documentée.

## Vérification

- `npm run build` : réussi (TypeScript et Vite). Avertissement existant sur un fichier JavaScript volumineux, sans échec de compilation.
- Suites réussies : `test:support-agent-navigation`, `test:support-queue-accessibility`, `test:support-queue-status-labels`, `test:public-content-client-payload`, `test:assistant-policy`, `test:agent-security-gates`, `test:support-agent` (inclut `test:assistant-school-context`), `test:support-contact-input`, `test:public-assistant-contrast`.
- `node --experimental-strip-types scripts/test-school-public-information.mjs` : six contrôles des limites de date et de l’expiration.
- Le seul test existant adapté attend maintenant « À attribuer » à la place de « Sans agent » ; les assertions de comportement et de sécurité restent présentes.
- Navigateur local : accueil et formulaire cantine à 390 pixels, coordonnées et rendez-vous sur mobile, catalogue et connexion du personnel à 1366 pixels. Aucun débordement horizontal constaté sur les parcours mesurés. Les appels IA et les envois sont désactivés dans cette prévisualisation locale ; elle ne démontre pas la délivrabilité des emails ni l’accès aux dossiers réels.

## Intégration avec Claude

Intégrer uniquement le commit de cette branche dans la branche commune, après mise à l’abri de son travail en cours. Le fichier `LyceeConnectPrototype.tsx` concentre les textes et peut entrer en conflit avec ses changements : conserver ses comportements récents et reprendre les formulations corrigées. Le CSS contient des ajouts limités au rendez-vous et à la lisibilité des coordonnées.

Ne pas déployer isolément toute la base `cd512c4` pour cette seule révision : elle contient aussi des travaux fonctionnels en attente de recette et de migrations. Intégrer ce lot au déploiement coordonné. Le problème des emails répétés, l’espace DDFPT, les imports réels et les migrations des informations flash restent des chantiers distincts.

Lorsque le circuit éditorial sera utilisé en production, gérer les événements dans le CMS, retirer l’encart statique pour éviter un double affichage, puis publier les faits validés dans le registre de connaissances de l’agent. Une correction de texte dans l’interface n’est pas un entraînement du modèle.
