# Audit externe Claude et contre-verification - 26 aout 2026

## Methode

Claude CLI 2.1.126, modele Opus avec effort eleve, a relu le depot en mode
lecture seule a partir du mega-prompt versionne dans
`CLAUDE_GENERAL_AUDIT_PROMPT.md`. Il n'a modifie aucun fichier et n'a pas execute
les tests distants. Son verdict global etait **pilote fictif**, ce qui reste le
verdict retenu apres contre-verification.

Un signalement externe n'est pas accepte automatiquement. Chaque point est
classe selon le code, la configuration inspectee et les tests réellement
executes.

## Points confirmes et corriges

1. **Reception email et reprise apres panne.** Le reçu du webhook etait ecrit
   avant la transaction du message. Le reçu, le message, l'evenement et la file
   PGMQ sont maintenant engages ensemble; un echec annule tout et permet le
   rejeu.
2. **Confirmation d'identite trop declarative.** Un agent ne peut plus marquer
   une identite scolaire confirmee sans demande deja rattachee a un eleve ou un
   professeur de la liste officielle.
3. **Transmission sensible avant verification.** Pour ENT et email academique,
   le serveur n'accepte avant confirmation qu'une consigne de verification fixe,
   sans identifiant ni code.
4. **Lien email trop large.** Un jeton cible maintenant un contact precis. Les
   anciens jetons ne valident une adresse que lorsqu'un seul contact email actif
   existe. La file d'envoi lie egalement ce jeton et son destinataire au meme
   contact.
5. **Empreinte reseau trop durable.** La copie stockee avec le dossier a ete
   supprimee. Le limiteur distribue conserve seulement une empreinte temporaire.
6. **Concurrence des pieces jointes.** La verification du plafond de cinq
   fichiers et la reservation sont desormais serialisees par dossier.
7. **Configuration email figee.** Les chemins serveur et worker exigent
   `SUPPORT_FROM_EMAIL`; aucune adresse d'expediteur n'est codee comme repli.
8. **Separation des projets.** La reference ESSUF dans le responsable de rotation
   a ete retiree du registre de cette application lycee.
9. **Reconstruction de la base.** Les migrations historiques absentes ont ete
   recuperees depuis le journal de migrations Supabase et ajoutees a Git, sans
   exporter les donnees.

## Alertes rejetees ou surestimees

- **Modele OpenAI inexistant.** Faux dans l'environnement teste : l'appel reel de
  preview a renvoye `usedAi: true` avec une reponse structuree. Le repli local
  reste disponible si le fournisseur refuse un futur appel.
- **Deux consommateurs PGMQ impliquent des doublons certains.** Non demontre.
  PGMQ applique un delai de visibilite lors de la lecture et le depot ne contient
  aucune planification Vercel active. La route Vercel existe comme possibilite
  de secours, tandis que le worker documente est lance par timer VPS. Avant un
  pilote reel, l'exploitation doit tout de meme confirmer un seul ordonnanceur
  actif et verifier les journaux.
- **Adresse email publique equivalente a un secret.** L'adresse d'expedition du
  lycee n'est pas une cle. Le repli code a quand meme ete retire afin que chaque
  environnement declare explicitement son expediteur.
- **Limiter le reseau du lycee a 50 appels.** Inadapte au besoin annonce de 200
  personnes simultanees derriere le meme acces. Les limites par appareil restent
  strictes et le plafond reseau absorbe le NAT de l'etablissement.

## Points encore valables et ouverts

- Tests automatises RLS, transactions concurrentes, webhooks rejoues, jetons et
  injections de consignes encore incomplets.
- Pseudonymisation du texte libre a renforcer et tester avant donnees reelles.
- Controle de concurrence optimiste dans la console agent a ajouter.
- Pieces jointes aux reponses agent, notes internes, transfert, cloture motivee
  et modeles de reponse encore incomplets.
- Authentification individuelle avec MFA, protection des mots de passe compromis,
  sauvegarde chiffree et restauration testee, purge et validation DPO restent
  bloquantes.
- Refaire une base jetable depuis toutes les migrations afin de valider la
  reconstruction complete.

## Conclusion

L'audit externe a trouve plusieurs vrais defauts de reprise et d'identite qui
ont ete corriges dans la preview. Il a aussi produit quelques conclusions non
confirmees. Le classement final reste : demonstration protegee et pilote avec
donnees fictives autorises; donnees reelles a grande echelle et remplacement du
site officiel interdits tant que les blocants d'exploitation ne sont pas fermes.
