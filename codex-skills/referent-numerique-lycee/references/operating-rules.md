# Regles d'exploitation et de securite

## Cartographie a ne pas confondre

- Depot du portail/LyceeGest : `abenmahmoud/Stage-Pilot`.
- Projet Vercel : `safe-scol/lyceegest`; `safe-scol` est le compte equipe, pas le
  nom du produit.
- Site officiel historique : heberge separement chez Hostinger. Il reste en place
  jusqu'a validation complete de la migration.
- Webmail du Lycee : application separee accessible sous
  `mail.lycee-blaise-cendrars-sevran.fr`.
- VPS : traitements longs et workers seulement; ne pas le modifier sans ordre
  explicite et controle prealable.

Verifier les identifiants et URLs dans l'etat courant avant toute action : cette
cartographie oriente la recherche, elle n'autorise aucune mutation.

## Donnees et secrets

- Ne jamais placer dans un skill, une spec ou Git : mots de passe, codes ENT,
  jetons, cles API, listes nominatives completes, contacts personnels ou pieces.
- Cles OpenAI, Brevo, Supabase `service_role` et secrets de webhook uniquement
  cote serveur.
- Stockage prive, liens temporaires, quarantaine et antivirus pour les fichiers.
- Journaux sans texte integral des demandes ni coordonnees completes.
- L'assistant ne recoit que le minimum pseudonymise et jamais le contenu brut des
  fichiers tant que ce traitement n'est pas expressement valide.

## Identite et autorite

- Un lien email verifie le controle de l'adresse, pas l'identite scolaire.
- Un numero de dossier seul ne donne aucun acces.
- La transmission de codes ou donnees personnelles exige une identite confirmee
  selon une procedure du lycee.
- Comptes agents individuels et authentification renforcee en production; aucun
  code direction partage pour la console definitive.
- A0-A2 peuvent etre automatises selon une regle publiee; A3 exige validation;
  A4 est transfere et ne doit jamais etre execute par l'IA. La preuve d'identite
  I0-I4 et le role sont controles separement avant chaque action.

## Livraison

- Preview Vercel avant production, tests ordinateur/telephone et controle des
  en-tetes de securite.
- Aucune bascule du domaine principal avant reprise des contenus, validation de
  la direction, validation protection des donnees et plan de retour arriere.
- Aucune donnee reelle en preview tant que les mentions, habilitations,
  conservations, sauvegardes et tests ne sont pas approuves.
- Un ancien feu vert ne vaut pas autorisation permanente. Reconfirmer la cible
  exacte pour DNS, Hostinger, VPS, imports, emails de masse et production.

## Charge, durabilite et preuves

- Separer trafic mensuel et pic de rentree. Dimensionner et tester les creations,
  messages, fichiers et reprises simultanes, pas seulement les pages vues.
- Un limiteur en memoire d'une fonction serverless n'est pas une protection
  distribuee; utiliser un mecanisme atomique partage et des identifiants haches.
- Pour les tables support uniquement serveur, RLS sans politique est volontaire
  si et seulement si les droits `anon` et `authenticated` restent revoques.
- Ne jamais declarer une sauvegarde operationnelle sans restauration reussie de
  la base et d'un fichier dans un environnement isole.
- Ne jamais declarer la base reconstructible tant que toutes les migrations
  historiques ne sont pas dans Git et rejouees sur une base jetable.
- Les tests de charge utilisent uniquement une preview prouvee, des donnees
  fictives, une execution identifiable et un nettoyage automatique.
- Chaque conclusion importante doit citer une preuve : test, requete de controle,
  journal, fichier ou configuration effectivement inspectee.
- Un audit externe est un signal a verifier, pas une preuve automatique. Conserver
  les constats confirmes, corriges, rejetes et restant ouverts.
