# Worker des documents de connaissance - recette VPS du 29 août 2026

## Périmètre autorisé

- Cible : VPS existant, répertoire isolé `/opt/lycee-support-preview`.
- Base : branche Supabase `guichet-lycee-preview` uniquement.
- Aucun changement Hostinger, DNS, Webmail, domaine principal ou autre service VPS.
- Aucun document réel ni aucune donnée personnelle utilisé pendant la recette.

## Chaîne installée

1. Le transfert TUS place le fichier dans le bucket privé `knowledge-ingest`.
2. La confirmation atomique met le document en quarantaine et envoie un travail
   dans `knowledge_document_scan`.
3. Le timer systemd d'une minute exécute le worker avec l'utilisateur isolé
   `lycee-support`, ClamAV, 768 Mo maximum et un délai de cinq minutes.
4. PDF, DOCX, XLSX, TXT et CSV sont extraits localement avec des limites de
   pages, feuilles, dimensions, taille d'archive et texte conservé.
5. Les classifications personnelles/sensibles et les signaux de coordonnées ou
   codes ne conservent aucun texte extrait ; PPTX et images restent manuels.
6. Le document aboutit à `review`. Une validation humaine avec MFA crée une
   source en brouillon, sans publication ni activation automatique de l'agent.

## Installation additive

- Sauvegarde des manifestes précédents dans
  `/root/lycee-support-backups/20260829-knowledge-worker`.
- Dépendances verrouillées : `pdfjs-dist` 5.4.624, `mammoth` 1.12.2 et
  `yauzl` 3.4.0 ; audit npm sans vulnérabilité.
- Migration `20260828234000` testée dans une transaction annulée avant
  application et enregistrée dans l'historique de la preview.
- Les tables de file sont interdites aux rôles `anon` et `authenticated`.

## Preuves de recette

1. Exécution à vide du service : code `0`.
2. Texte fictif propre : état `review`, extraction locale complète, SHA-256 et
   attente de validation humaine.
3. EICAR : état `rejected`, objet de stockage supprimé et motif conservé.
4. Nettoyage : zéro document, audit et travail de test restant.
5. Second déclenchement autonome : zéro travail réclamé et code `0`.
6. ClamAV, annuaire privé, pièces jointes et email sont restés actifs.
7. Tests locaux : 24 scénarios documentaires et de registre, compilation complète
   et audits npm sans vulnérabilité.

## Limites restantes

- Une source brouillon n'est pas encore une compétence active. Elle doit être
  publiée, reliée à une version testée, puis seulement injectée dans le contexte
  autorisé de l'agent.
- Les images et présentations demandent encore une lecture humaine ; aucun OCR
  local n'est activé.
- Le VPS utilise encore Node 20.20.2. Le lot fonctionne, mais une migration
  contrôlée vers Node 22 ou plus récent est requise avant la production durable.
- Le disque disposait d'environ 20 Go libres ; ajouter supervision et politique
  de rétention avant des dépôts réels volumineux.
- Aucun document réel avant validation Direction/DPO des finalités,
  habilitations, durées, sauvegardes, purge et procédure d'incident.

## Arrêt contrôlé

En cas d'incident, arrêter puis désactiver
`lycee-knowledge-document-worker.timer`, conserver les journaux et vérifier les
documents ainsi que la file de preview. Restaurer les manifestes sauvegardés si
nécessaire. Ne jamais supprimer une file ou un objet sans identifier son
établissement, son propriétaire et son état.
