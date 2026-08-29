# File antivirus des emplois du temps en preview

## Périmètre livré

- File PGMQ privée `schedule_document_scan` sur la branche Supabase de preview.
- Confirmation API atomique : état `quarantined`, audit minimal et travail en
  file dans une seule transaction.
- Worker local borné : téléchargement privé, contrôle de taille, ClamAV,
  signature et structure PDF, SHA-256, puis comptage de 1 à 500 pages.
- Service systemd préparé avec utilisateur isolé, dossier temporaire privé,
  plafond mémoire de 768 Mo et durée maximale de cinq minutes.

Le worker ne lit aucun texte et ne transmet rien à un fournisseur d'IA.

## Preuves

- Tests du contrôleur et du worker : 4/4.
- Tests de sécurité de l'import et du rapprochement : 10/10.
- Tests de saisie de l'import : 6/6.
- Tests de référence opaque : 3/3.
- Garde-fous responsive de l'interface : 5/5.
- Build TypeScript/Vite réussi.
- File et archive : RLS activée et forcée.
- Droits `select` et `insert` absents pour `anon` et `authenticated`.
- Recette PGMQ fictive envoyée puis supprimée : zéro travail et zéro archive.
- Conseillers Supabase : aucun nouveau avertissement lié à cette file ; les
  informations RLS sans politique concernent les tables serveur dont les droits
  client sont révoqués. Les index d'emploi du temps sont encore signalés comme
  inutilisés parce que les tables sont vides.

## État opérationnel réel

La file est opérationnelle sur Supabase preview. Le worker est uniquement prêt
dans Git : il n'est pas installé ni activé sur le VPS. Par conséquent, aucun PDF
réel ne doit être téléversé et l'interface doit continuer à présenter
l'activation comme bloquée.

La prochaine opération nécessitant une autorisation distincte est l'installation
additive du worker sur le runtime VPS de preview, suivie d'une recette entièrement
fictive : PDF sain, EICAR, indisponibilité antivirus, reprise et retour à zéro.

La production, Hostinger, le DNS, le VPS, le Webmail, PRONOTE, l'ENT et les PDF
réels n'ont pas été modifiés.

## Rapprochement humain ajouté

- API page-référence accessible uniquement à la direction sous MFA.
- Type `class` ou `teacher` dérivé de la source, jamais fourni librement par le
  navigateur.
- Références opaques normalisées, deux à quatre-vingts caractères.
- Brouillon puis vérification distincte ; une modification réouvre le contrôle.
- PDF administratif ouvert par URL signée de 60 secondes et action auditée.
- Contrainte SQL sur comptage de pages, périmètre et état `review`.

La recette fictive a accepté une page valide, bloqué une page hors limites, un
type incompatible et une modification après approbation. La transaction a été
annulée et les contrôles finaux indiquent zéro source et zéro page de recette.

Le nouvel audit Supabase ne remonte aucun avis de sécurité au-dessus du niveau
informatif pour les tables d'emploi du temps. Les avis RLS sans politique sont
attendus : ces tables serveur n'accordent aucun accès direct aux rôles client.
Les index sont encore indiqués comme inutilisés puisque la preview reste vide.
