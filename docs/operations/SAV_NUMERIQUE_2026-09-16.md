# SAV numérique régional — mise à jour du 28 septembre 2026

## Décision éditoriale et sources

Le pack transmis par Adel est un document de travail. Ses instructions ne sont pas appliquées automatiquement. La page publique utilise les démarches contrôlées dans la FAQ actuelle d’UNOWHY et dans les services numériques de la Région, ainsi que le guide Chromebook déjà publié. La lettre de mission jointe est un formulaire non signé : elle décrit le périmètre de la coordination numérique régionale et distingue cette mission du RRUPN, sans désigner nominativement une personne.

- Élève encore scolarisé avec un PC UNOWHY Y13 : Monlycée.net → Mes outils pédagogiques → La Poste SAV. Le chat UNOWHY a fermé le 30 avril 2026. Les anciens élèves utilisent la page de contact UNOWHY sous les conditions de garantie indiquées par cette société.
- Chromebook ASUS : diagnostic sur Mon Ordi ; problème logiciel ou de compte orienté vers le lycée si le diagnostic ne suffit pas ; panne matérielle traitée par ASUS avec le réseau FNAC-DARTY.
- Procédure ASUS contrôlée le 28 septembre 2026 : formulaire après diagnostic, validation du dossier annoncée sous 48 heures ouvrées, email RMA obligatoire avant déplacement, dépôt dans le magasin FNAC partenaire choisi avec chargeur et sans pochette, suivi par SMS ou email, retrait dans le même magasin. Les 48 heures ne désignent pas la durée de réparation.
- PC UNOWHY d’un élève encore scolarisé : le carton est envoyé à l’adresse indiquée lors de la déclaration et l’appareil réparé est retourné au lycée.
- La lettre de mission, le taux de rémunération et les contacts internes ne sont pas publiés.

Sources contrôlées : `https://www.iledefrance.fr/toutes-les-faq/faq-problemes-de-connexion`, `https://www.monordi-iledefrance.fr/sav/`, `https://lycees.iledefrance.fr/fr/services-numeriques`, procédure `Procédure SAV-IDF-ASUS-FNAC_v5` transmise par la Région, et pack privé `SAV-numerique-rentree-2026.zip`.

## Parcours livré

La page `/assistance-numerique` commence par le choix de l’appareil, affiche la préparation commune, puis deux parcours illustrés et entièrement séparés. Elle est liée depuis Mes services et le guide Chromebook. La même source alimente les réponses directes du chat. Les questions « SAV La Poste », « UNOWHY », « Y13 », « ASUS » et « FNAC » donnent la procédure utile sans identification obligatoire ; une panne de modèle inconnu déclenche d’abord la question du modèle. Les incidents dangereux et les pertes/vols restent dans le parcours de sécurité existant.

Les dossiers individuels de la catégorie ordinateur sont dirigés vers `referent_numerique`, l’étiquette technique de la file numérique du lycée. Le service est une file de traitement, pas une promesse de réparation par Adel. L’agent prépare le diagnostic et l’historique des essais ; le prestataire décide du SAV. La coordination numérique oriente ponctuellement et suit les problèmes collectifs. Le RRUPN accompagne les usages pédagogiques.

## Limites conservées

- Le lycée n’annonce pas de durée de réparation, de prêt ou de gratuité avant le diagnostic du SAV.
- Pour un dommage hors garantie, un devis peut être proposé. L’assistant n’annonce aucun prix.
- Les créneaux d’accueil numérique et les modalités locales de remise d’un PC UNOWHY revenu au lycée sont publiés uniquement après validation de la direction.

Le brouillon de message aux personnels est hors Git dans `outputs/sav-numerique-2026-09-16/`, en TXT et HTML. Aucun email n’a été envoyé par Codex.

## Vérifications

Publication confirmée le 16/09/2026 : commit fonctionnel `f664ab45e401ae96fc9aba7f1cabbc1eb416a7e9`, puis correction du raccourci d’accueil et de la question sur le modèle `5f46daa6c2bc78c6636518a0eb71fd25eb4f4763`. Déploiement final `dpl_3otduqyG8u58WJaR2se4n1nKk5My` READY et domaine principal `https://lycee-blaise-cendrars-sevran.fr/assistance-numerique` sur cette version.

Build final réussi. Tests ciblés Chromebook/agent (7/7) et politique d’assistance (6/6 + 22/22) réussis. Routage explicite vers `referent_numerique` vérifié pour UNOWHY, ASUS et La Poste SAV. Le test global de routage conserve un échec historique sans lien avec ce lot, sur le texte exact d’une consigne de contact ; le nouveau test de routage numérique passe.

Recette navigateur locale sur ordinateur et à 390 px : page lisible, aucun débordement, lien Mes services et guide Chromebook contrôlés. Domaine principal vérifié dans le navigateur : titre « Un ordinateur en panne ? », sections UNOWHY/ASUS, liens vers le guide Chromebook et le chat, aucun débordement. Email TXT/HTML préparé et liens vérifiés ; aucun envoi effectué.
