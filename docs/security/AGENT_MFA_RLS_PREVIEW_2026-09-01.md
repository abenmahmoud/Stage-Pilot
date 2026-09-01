# MFA obligatoire sur les acces directs a la base

## Constat et correction

Le catalogue de la preview confirmait une ancienne exception : les roles
`superadmin`, `administration` et `proviseur` pouvaient franchir le verrou MFA
sans facteur enrole. Le role `agent` n'etait pas inclus. Le garde de l'API et
l'interface, renforces au lot precedent, ne corrigeaient pas ce chemin direct.

La migration `20260901210917_require_agent_mfa_for_direct_database_access.sql`
renomme ce verrou en `agent_mfa_required` et exige AAL2 pour les quatre roles.
Elle verifie d'abord la presence de la politique restrictive attendue et de
RLS, puis conserve le mode `ALL`, la cible `authenticated`, `USING` et
`WITH CHECK`. Pas de nouvelle politique permissive, fonction privilegiee,
permission SQL ou exception d'enrolement. Les metadonnees utilisateur editables
ne sont pas utilisees pour l'autorisation.

Tables : `classes`, `eleves`, `etablissement`, `fiches_grand_oral`, `import_logs`,
`notifications_log`, `professeurs`, `stages`, `templates_documents`.

## Cible et preuves

- Branche Supabase verifiee avant application : `guichet-lycee-preview`,
  reference `xijocumlwivhbmffrnlj`, `is_default=false`. La base principale n'a
  recu aucune ecriture. Migration appliquee avec succes le 1er septembre 2026.
- Fichier cree par la CLI deja installee, puis nom aligne sur la version
  `20260901210917` effectivement retournee par le journal des migrations.
- Comparaison du catalogue avant/apres : les 20 autres politiques et les
  252 lignes de permissions des neuf tables sont strictement identiques.
- Recette `supabase/tests/agent_mfa_required_security.test.sql` executee sur
  PostgreSQL : 360 assertions sur les expressions installees des neuf tables,
  avec les quatre roles agents et cinq niveaux (AAL1, AAL2, nul, inconnu, vide).
- 35 cas executent SELECT, INSERT, UPDATE et DELETE sur une classe fictive :
  sept roles et cinq niveaux. AAL1 ne passe pas pour les agents ; AAL2 conserve
  les restrictions existantes. `agent` et `proviseur` ne gagnent pas le droit
  d'ecriture sur les classes. Les roles eleve, professeur et PP gardent leurs
  regles existantes, sans nouvelle obligation MFA.
- Quatre operations anonymes refusees ; lecture serveur conservee. Les essais
  utilisent des claims fictifs sous `authenticated` non proprietaire et soumis
  a RLS, jamais la cle serveur comme preuve d'un refus RLS.
- Transactions annulees, UUID aleatoires, aucune personne ou facteur Auth cree,
  aucune notification. Controle independant apres execution : **zero classe
  de test restante**. La recette s'arrete si de nouveaux triggers applicatifs
  apparaissent sur `classes`, afin de revoir leurs effets avant toute fixture.
- `test:agent-mfa-rls` : trois controles de contrat hors ligne, inclus dans
  `test:support-agent-access` puis la barriere de securite. Ils ne se substituent
  pas a la preuve PostgreSQL ci-dessus. Integrite : 90 migrations distinctes.
- Compilation, barriere complete de securite, quatre contrats responsive et
  integrite Spec Kit passent. L'avertissement XLSX de taille reste preexistant.
  555 taches : 453 terminees, 102 ouvertes ; pas un pourcentage operationnel.
- Conseiller Supabase apres migration : aucun nouveau constat, aucune alerte
  WARN/ERROR ; 62 avis INFO preexistants `rls_enabled_no_policy` inchanges.
  Cela ne constitue pas un audit exhaustif de l'application.

## Rejouer sans risque

1. Verifier de nouveau la cible de preview et son caractere non principal.
2. Verifier que la migration est deja appliquee ; ne pas la relancer.
3. Executer le fichier SQL complet dans une seule connexion, y compris le
   `ROLLBACK` final, avec un executeur de test autorise. Il n'exige pas pgTAP.
4. Attendre `status=passed`, `predicate_assertions=360`, `class_crud_cases=35`.
5. Verifier separement que les lignes portant le prefixe `TEST MFA RLS - ` et
   l'annee `2099-2100` sont absentes. Une erreur n'autorise pas un nettoyage large.

La recette a d'abord refuse la configuration non migree. Une erreur syntaxique
du test, puis une collision entre deux noms de classe fictifs, ont ete corrigees
avant le resultat reussi. Les echecs sont annules, pas comptes comme des preuves.

## Limites encore ouvertes

- Ce lot ne teste pas l'emission ou la validation cryptographique des JWT,
  l'enrolement Auth reel, la recuperation des comptes ou la revocation immediate
  d'une session. Une claim AAL2 existante peut rester valable jusqu'au
  renouvellement du jeton : ne pas annoncer une invalidation instantanee.
- Le verrou ne remplace pas les politiques de lignes historiques, ne rajoute
  pas d'adhesion institutionnelle aux tables historiques et ne prouve pas un
  lien parent-enfant. Les perimetres legacy meritent leur propre revue.
- Les expressions des neuf tables sont exercees, mais seules les quatre
  operations sur `classes` sont testees avec une ligne. Pas de pretention a une
  recette CRUD complete des neuf tables, des vues ou de toutes les RPC.
- T049C, T007B, publication de documents personnels, quotas et contre-revues
  restent ouverts. Aucun nouvel appel Claude : aucune autorisation en attente
  n'est consommee ou etendue silencieusement a ce lot.
- Aucun changement de production, DNS, VPS, Webmail, compte reel ou donnee
  personnelle. Aucun composant visuel modifie.

References officielles consultees :
[RLS et politiques restrictives](https://supabase.com/docs/guides/database/postgres/row-level-security),
[avis RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
