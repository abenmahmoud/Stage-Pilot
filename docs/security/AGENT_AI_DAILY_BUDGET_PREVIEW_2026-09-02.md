# Enveloppe quotidienne IA en preview

**Date** : 2 septembre 2026
**Périmètre** : branche applicative `codex/lycee-connect-prototype` et branche
Supabase `guichet-lycee-preview` uniquement
**Tâche** : T049C9

## Résultat

LyceeGest possède maintenant une enveloppe quotidienne atomique commune aux
trois appels OpenAI actuels : assistant public, aide à la rédaction du site et
aide aux communications. Chaque appel réserve avant le réseau un montant maximal
configuré pour son opération. Les échecs fournisseur ne rendent pas la réserve :
le mécanisme est volontairement conservateur.

Le garde est désactivé par défaut. Son activation exige les quatre valeurs
serveur suivantes, sans valeur choisie dans le code :

- `OPENAI_BUDGET_GUARD_ENABLED=true` ;
- `OPENAI_DAILY_BUDGET_EUR` ;
- `OPENAI_SUPPORT_MAX_CALL_EUR` ;
- `OPENAI_CONTENT_MAX_CALL_EUR` ;
- `OPENAI_COMMUNICATION_MAX_CALL_EUR`.

Lorsqu'il est activé, un montant absent, mal formé, nul ou supérieur au budget
quotidien ferme l'appel IA. L'assistant revient à son parcours local et au
formulaire ; les deux aides privées affichent une indisponibilité ou la limite
quotidienne. Aucune conversation, identité, adresse ou pièce n'entre dans le
compteur.

## Base et concurrence

La migration `20260901225812_create_agent_ai_budget_days.sql` est installée sur
la seule preview. La table est en RLS forcée, sans politique publique ; les
rôles `public`, `anon` et `authenticated` n'ont aucun droit. Le rôle serveur a
uniquement `SELECT`, `INSERT` et `UPDATE`.

Deux preuves ont été exécutées avec des dates fictives puis nettoyées :

- deux réservations de 400 000 micro-euros sont acceptées sur une limite de
  1 000 000 ; la troisième est refusée ;
- dix réservations de 300 000 micro-euros lancées simultanément donnent
  exactement trois acceptations, 900 000 micro-euros réservés et aucune erreur.

Les deux scénarios finissent avec `remaining_fixture_rows = 0`. Les conseillers
Supabase signalent 63 informations de sécurité, dont l'absence volontaire de
politique sur cette table serveur, zéro avertissement/erreur de sécurité et les
16 avertissements de performance déjà présents. Aucun nouveau constat de
performance ne vise cette table.

## Limites et activation

Cette enveloppe applicative complète le garde de trafic, mais ne remplace pas le
plafond dur du projet fournisseur. La documentation OpenAI décrit un `Project
Spend Limit` comme une limite ferme au niveau du projet :
https://developers.openai.com/api/reference/typescript/resources/admin/subresources/organization/subresources/projects

T049C reste ouverte jusqu'à la décision humaine sur les montants, la vérification
des prix de chaque modèle, la configuration du plafond dur OpenAI, l'activation
contrôlée en preview et la contre-revue indépendante. Aucun montant, appel
OpenAI, donnée réelle, production, email, DNS, VPS, Hostinger, Webmail, ENT ou
PRONOTE n'a été modifié pendant ce lot. Claude est resté en pause.
