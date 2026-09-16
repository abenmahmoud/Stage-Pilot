# SAV numérique régional — 16 septembre 2026

## Décision éditoriale et sources

Le pack transmis par Adel est un document de travail. Ses instructions ne sont pas appliquées automatiquement. La page publique utilise les démarches contrôlées dans la FAQ actuelle d’UNOWHY et dans les services numériques de la Région, ainsi que le guide Chromebook déjà publié. La lettre de mission jointe est un formulaire non signé : elle décrit le périmètre de la coordination numérique régionale et distingue cette mission du RRUPN, sans désigner nominativement une personne.

- Élève encore scolarisé avec un PC UNOWHY Y13 : Monlycée.net → Mes outils pédagogiques → La Poste SAV. Le chat UNOWHY a fermé le 30 avril 2026. Les anciens élèves utilisent la page de contact UNOWHY sous les conditions de garantie indiquées par cette société.
- Chromebook ASUS : diagnostic sur MonOrdi IdF ; SAV constructeur avec appui Fnac-Darty.
- Le pack donne des détails sur le kit, les exclusions, le retour et le lieu de retrait. Ces détails ne deviennent pas une promesse publique sans confirmation actuelle du prestataire ou décision de la direction.
- La lettre de mission, le taux de rémunération et les contacts internes ne sont pas publiés.

Sources consultées le 16/09/2026 : `https://iledefrance-unowhy.com/assistance-faq/`, `https://iledefrance-unowhy.com/contact-assistance/`, `https://lycees.iledefrance.fr/fr/services-numeriques`, pack privé `SAV-numerique-rentree-2026.zip`. Attention : le lien « Livret de rentrée 2026 » sur la page régionale renvoie au moment de la vérification vers un PDF 2025 ; ne pas s’appuyer dessus pour de nouveaux détails 2026.

## Parcours livré

La page `/assistance-numerique` présente les deux modèles, les étapes, les liens officiels, la place du chat et la répartition des responsabilités. Elle est liée depuis Mes services et le guide Chromebook. Les informations publiques de l’ancien PC alimentent aussi les réponses directes du chat. Les questions « SAV La Poste », « UNOWHY » et « Y13 » donnent le parcours ENT sans identification obligatoire ; une panne de modèle inconnu déclenche d’abord la question du modèle. Les incidents dangereux et les pertes/vols restent dans le parcours de sécurité existant.

Les dossiers individuels de la catégorie ordinateur sont dirigés vers `referent_numerique`, l’étiquette technique de la file numérique du lycée. Le service est une file de traitement, pas une promesse de réparation par Adel. L’agent prépare le diagnostic et l’historique des essais ; le prestataire décide du SAV. La coordination numérique oriente ponctuellement et suit les problèmes collectifs. Le RRUPN accompagne les usages pédagogiques.

## À décider avec la direction

- Personne ou service chargé de réceptionner et remettre les appareils éventuellement retournés au lycée ; preuve de remise et notification à l’élève.
- Créneaux d’accueil numérique, lieu et canal de contact à publier. En attendant, la page propose le chat et un rendez-vous confirmé individuellement.
- Vérifier avec la Région les conditions de retour ASUS et les exclusions de garantie avant d’en donner une réponse catégorique.

Le brouillon de message aux personnels est hors Git dans `outputs/sav-numerique-2026-09-16/`, en TXT et HTML. Aucun email n’a été envoyé par Codex.

## Vérifications

Publication confirmée le 16/09/2026 : commit fonctionnel `f664ab45e401ae96fc9aba7f1cabbc1eb416a7e9`, puis correction du raccourci d’accueil et de la question sur le modèle `5f46daa6c2bc78c6636518a0eb71fd25eb4f4763`. Déploiement final `dpl_3otduqyG8u58WJaR2se4n1nKk5My` READY et domaine principal `https://lycee-blaise-cendrars-sevran.fr/assistance-numerique` sur cette version.

Build final réussi. Tests ciblés Chromebook/agent (7/7) et politique d’assistance (6/6 + 22/22) réussis. Routage explicite vers `referent_numerique` vérifié pour UNOWHY, ASUS et La Poste SAV. Le test global de routage conserve un échec historique sans lien avec ce lot, sur le texte exact d’une consigne de contact ; le nouveau test de routage numérique passe.

Recette navigateur locale sur ordinateur et à 390 px : page lisible, aucun débordement, lien Mes services et guide Chromebook contrôlés. Domaine principal vérifié dans le navigateur : titre « Un ordinateur en panne ? », sections UNOWHY/ASUS, liens vers le guide Chromebook et le chat, aucun débordement. Email TXT/HTML préparé et liens vérifiés ; aucun envoi effectué.
