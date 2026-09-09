# Accueil et aide : une conversation — 9 septembre 2026

Adel signale la longueur du parcours et la différence ressentie entre l’accueil
et l’aide. Le même `HelpDeskView` traite déjà les demandes, mais le texte de
l’accueil était aussi utilisé comme message initial à chaque remontage. Revenir
à l’aide pouvait donc rejouer la première question au lieu de lire le brouillon.

## Corrections

- Message encore saisi sur l’accueil séparé du message explicitement envoyé.
  Se déplacer vers l’aide ne soumet pas ce texte. L’entrée envoyée est consommée
  une seule fois ; l’accueil ne la conserve pas comme nouvelle demande.
- « Besoin d’aide » ouvre directement le chat. Même nom « Blaise, votre
  assistant » sur l’accueil et dans l’aide. « Reprendre ma conversation » ouvre
  le brouillon sans afficher de nom ni contenu privé sur l’accueil.
- Sauvegarde différée vidée lors du départ de la page. Écritures et effacement
  du brouillon sérialisés dans l’onglet avant sa relecture. Le choix d’effacer,
  la création confirmée et l’interception SafeScol annulent la sauvegarde en attente.
- Appel du chat annulé côté navigateur lorsqu’on quitte la page ou efface le
  brouillon. Une réponse ancienne ne peut plus remplir la conversation effacée.
  À la reprise, seule une question restée sans réponse est réanalysée.
- Les étapes déjà remplies sont passées lors de la réouverture de la préparation.
  Si les informations sont complètes, le récapitulatif apparaît directement.
  « Modifier mes coordonnées » reste disponible. Aucun état local ne constitue
  une preuve d’identité scolaire : protections et OTP serveur conservés.
- L’envoi du chat attend la fin de la restauration locale pour éviter une course
  entre une nouvelle question et le chargement de l’ancien brouillon.

## Vérification

31 tests ciblés réussis sur mémoire, contrats du chat, données interdites,
classification, création et confirmation de messages. Un test de mémoire était
resté sur l’ancienne syntaxe de réinitialisation des champs ; l’assertion suit
désormais la construction existante avec les valeurs par défaut.

Build TypeScript/Vite et recette Playwright sur
`http://127.0.0.1:5189/` et `/?view=help`, à 1 440, 390 et 320 px. Plugin Browser
absent. API simulées avec personnes fictives, aucun dossier créé, aucun email ou
SMS réel. Artefacts hors Git : `../tmp/qa-public-journey` et
`../tmp/qa-identity-reuse`.

Vérifié : texte non envoyé conservé → accès direct par le bouton d’accueil →
envoi volontaire → retour accueil → reprise sans répétition → préparation →
récapitulatif retrouvé avec contact éditable → effacement respecté → reprise
d’une question interrompue → rechargement sans doublon affiché. Aucune donnée
de contact du formulaire dans les appels IA simulés, aucune erreur console ni
débordement horizontal. La recette SMS utilise un seul OTP, conserve la
possibilité de corriger et vérifie la confirmation avant changement de personne.

Limites : les fichiers doivent toujours être resélectionnés après avoir quitté
le chat, comme indiqué par le message de reprise. Les données officielles et
modèles indisponibles ne deviennent pas des services automatiques par ce lot.
L’annulation navigateur ne prouve pas l’arrêt du calcul déjà commencé chez un
fournisseur. La restauration reste locale à l’appareil et ne remplace aucun
contrôle d’accès serveur.

## Publication

À vérifier après déploiement. Retour arrière : commit `ed347b8`, déploiement
`Epp6JwGfaGqEEC59sSbuwAfjGFWM`. Aucun changement de schéma ni de configuration.
