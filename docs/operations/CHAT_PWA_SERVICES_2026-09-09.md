# Conversation, PWA et services — 9 septembre 2026

## Demande du propriétaire
Adel demande une entrée par le chat, des écrans moins chargés, des textes vérifiés contre le livret et les hebdos, du push hors session ouverte et des espaces services sans MFA obligatoire pendant les essais réels. Cette décision remplace la consigne antérieure de passer rapidement au formulaire. Aucune promesse de délai automatique ou de complétude globale n'est faite.

## Livraison
- Vérification d'identité à l'intérieur de la conversation : identité, choix email/téléphone connu, recherche puis code seulement après succès de l'envoi. Possibilité de transmettre sans vérification.
- Coordonnées et récapitulatif par étapes dans le chat ; formulaire classique conservé comme choix explicite. Les champs privés et OTP ne passent pas dans le modèle.
- Correction de la reprise après OTP : retrait du dernier message assistant avant l'appel, car le contrat exige une dernière intervention du demandeur.
- Sélection de fichiers disponible même lorsque le champ de conversation est fermé ; récapitulatif avant envoi.
- Changement de personne : révocation des sessions identité et suivi, effacement des données locales du suivi et du brouillon après succès. Une erreur de révocation n'est pas présentée comme un succès.
- Suppression des bandeaux redondants ; contrôles tactiles et disposition mobile progressive.
- Sources publiques vérifiées : adresse et téléphone (livret p. 1), carnet/carte à l'entrée (p. 14), justification des absences élèves (p. 10 et 15). Accueil sur rendez-vous et date de la rencontre des parents déjà confirmés par Adel.
- L'hebdo du 7 septembre indique 17 h 30 pour le 22 septembre. Cette précision reste à valider : le site et l'agent n'inventent pas une nouvelle validation. Aucun nom de personnel, absence ou agenda interne publié.
- PWA : raccourcis sur le domaine principal, écran hors connexion autonome, cache limité aux fichiers statiques, aucun cache des API, push générique et clic limité à la file autorisée.
- Push : abonnement volontaire lié à une session de suivi ou au compte agent ; contrôle du service et de l'établissement au moment du traitement, expiration, déduplication durable et regroupement. Aucune relance aveugle après résultat fournisseur incertain. Le worker vérifie toutes les minutes ; les délais des appareils restent externes.
- `/admin/services` présente chaque service, le nombre de comptes habilités et l'accès à sa file. Aucun compte partagé ni invitation envoyée.
- Mode d'essai sans MFA obligatoire pour `agent` et `administration` jusqu'au 23 septembre 2026, 23 h 59 Paris. Les adhésions et droits serveur restent obligatoires. Les opérations exigeant explicitement AAL2, et les rôles superadmin/direction, conservent ce contrôle. Les deux variables de date peuvent être supprimées pour fermer immédiatement l'exception.

## Infrastructure et recette
- Dépôt : Stage-Pilot, branche codex/lycee-connect-prototype ; cible existante : pilote Supabase xijocumlwivhbmffrnlj.
- Migration additive support_web_push, deux tables privées avec RLS et droits anon/authenticated révoqués. Script d'application limité au pilote.
- Clé push privée conservée uniquement dans `/etc/lycee-support-preview/push-worker.env` sur le VPS. Vercel ne reçoit que la clé publique et l'activation.
- Timer `lycee-support-push-worker.timer` actif, démarrage réussi avec zéro abonnement ; aucun envoi à une personne pendant la recette.
- Base PostgreSQL éphémère isolée : bon service et bonne session notifiés ; session révoquée, autre service, autre établissement exclus ; pas de doublon ; résultat incertain non rejoué ; deux tables RLS, zéro accès public. Transport fictif, zéro envoi externe. Conteneur supprimé après recette.
- Docker local inaccessible. VPS : disque 86 %, environ 29 Go libres, environ 10 Go de mémoire disponible au contrôle. Docker ne montre pas de saturation CPU/mémoire. Aucun volume d'un autre projet supprimé.

## À ne pas présenter comme terminé
- Réception d'un vrai OTP et d'un push sur le téléphone d'Adel : nécessite son appareil, son contact connu et son choix d'autoriser les notifications.
- Création des comptes supplémentaires : noms, emails professionnels et services des collègues à fournir ; la page distingue les services sans compte.
- Documents générés automatiquement : modèles officiels et données valides nécessaires, puis validation du parcours. Rien n'est inventé pour remplir une demande.
- EDT : l'agent ne lit qu'une version active et validée. La synchronisation du dossier ne remplace pas un export opérationnel réel de PRONOTE.
- Publication des nouveautés hebdomadaires et heure de la rencontre : validation humaine inchangée.

## Retour arrière
Revenir au déploiement Vercel précédent ; désactiver SUPPORT_PUSH_ENABLED et le timer push ; supprimer les deux variables de date du pilote MFA. Les tables additives peuvent rester sans abonnement actif. Ne pas supprimer les données de demandes.
