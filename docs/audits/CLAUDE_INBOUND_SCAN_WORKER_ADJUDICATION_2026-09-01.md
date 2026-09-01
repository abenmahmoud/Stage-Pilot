# Revue du worker des fichiers entrants

Date : 1er septembre 2026. Code de preview uniquement, non active.

## Autorisation et perimetre

Le proprietaire a confirme la mission proposee et porte son plafond a 5 USD.
Une seule execution Claude Fable 5, effort eleve, a ete lancee. Neuf fichiers
techniques (79 636 caracteres avec le brief) ont ete transmis : coeur du
worker, depot SQL, executable, validation de destination, adaptateur scanner,
transfert prive, politique de contenu, tests du worker et fixture SQL fictive.
Le contrat des contraintes PostgreSQL verifiees accompagne ces fichiers.

Livrable demande : constats precis, corrections minimales proposees en texte
et regressions ciblees. Aucun outil, MCP, personnalisation, sous-agent,
persistance de session ou navigateur n'est autorise. Aucune donnee personnelle,
piece utilisateur, variable secrete ou autre projet n'a ete transmis.
Codex applique et verifie les corrections, jamais le modele externe directement.

L'execution s'est terminee normalement en un tour, sans outil ni sous-agent.
Cout declare par le CLI : **2,035675 USD**, dont 2,01009 pour Fable 5 et
0,025585 pour un auxiliaire Haiku automatique du CLI. Le plafond de 5 USD
n'est pas une somme a depenser. Aucune relance n'a ete faite ; ce montant est
une mesure du CLI, pas une verification de facture ou du quota d'abonnement.

## Arbitrage du rapport

| Constat externe | Conclusion Codex | Action et preuve |
| --- | --- | --- |
| Perte d'un job lorsque l'objet est encore `reserved` | Non confirme dans le circuit actuel. Claude formulait une hypothese faute du producteur dans ses neuf fichiers. | `confirmCommunicationInboundObjectQuarantine` place l'objet en quarantaine et ajoute l'evenement puis `pgmq.send` dans la meme transaction. `storeAndConfirmCommunicationInboundObject` garde le verrou et l'orchestrateur attend cette transaction. Les tests d'ingestion verifient maintenant explicitement qu'aucun job n'existe pendant le depot et que l'objet est deja en quarantaine lors de l'envoi. Pas de changement du worker pour masquer une violation de ce contrat. Un job `reserved` injecte hors circuit est archive, pas detruit, sans toucher l'objet ni le scanner. |
| Absence de CA comme cause du refus de connexion | Cause actuelle rejetee : la validation de l'URL echoue avant creation du client et avant TLS. Confiance du certificat reel encore non verifiee. | Maintien de `rejectUnauthorized: true`. Aucun certificat invente, contournement TLS ou nouvelle variable de confiance ajoutee. La qualification future devra verifier la chaine et le nom d'hote avec le certificat officiel du projet si necessaire. |
| `Number()` accepte hexadecimal ou notation scientifique | Confirme, mineur, sans depassement des bornes existantes. | Regression d'abord en echec sur `0x2`, puis correction : chaine decimale canonique seulement, sans signe, espace, zero initial ou fraction. Bornes 1-20/1-4 conservees, valeurs par defaut uniquement en absence du parametre. 24 entrees invalides et bornes hautes testees. |
| Une voie du lot s'arrete apres une erreur DB | Choix borne confirme, pas un defaut prouve. | Les autres operations deja engagees sont attendues, compteur d'erreurs et code de sortie signalent l'echec. Pas de boucle de relance infinie ajoutee. |
| Erreur d'ecriture classee `storage_read_failed`, HTTP 400 au depot | Observations confirmees, compatibles avec le contrat ferme et la relecture de controle. | Aucun code d'erreur arbitraire ajoute. Un depot n'est confirme qu'apres relecture avec type, taille et empreinte exacts. |
| Les preuves SQL seraient toutes des simulations | Formulation trop large. | Le harnais JavaScript simule la transaction, mais la fixture SQL a bien ete executee precedemment sur la base de preview sous rollback. Cela ne prouve toujours pas le programme complet avec un moteur et un transport reels. |

Claude ne confirme aucune vulnerabilite critique dans ce perimetre. Cette
conclusion est une revue statique, pas une garantie de securite ni une recette.
Les propositions de patch n'ont pas ete appliquees automatiquement.

La documentation Supabase precise le controle de la CA et du nom d'hote en
mode de verification complete et la recuperation du certificat officiel du
projet. Cela appuie le prerequis de qualification, pas le diagnostic de panne
propose : [Postgres SSL Enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

## Contre-verification Codex

Un test de composition a ete ajoute pendant la revue : vrais adaptateurs de
lecture privee, scanner et depot propre, transport simule et processus Node
fictif. Deux scenarios prouvent la reprise apres erreur du scanner ou apres
rollback de la preuve, avec un seul depot physique simule, une seule preuve
terminale, conservation du travail jusqu'au succes et fermeture des processus.
Ce n'est ni un test de ClamAV ni une transaction contre PostgreSQL reel.

Les 23 tests du worker, la suite communications, la barriere de securite de
preview, la compilation et l'integrite Spec Kit passent. Les 89 migrations
conservent des versions uniques. L'avertissement anterieur de taille du module
XLSX demeure ; aucune dependance n'a change.

## Limites maintenues

T022K et T022 restent ouvertes. La connexion PostgreSQL locale de preview est
encore refusee et le moteur ClamAV reel n'est pas qualifie. Aucun service,
webhook, cron, envoi, secret, fichier reel ou environnement de production n'a
ete active. Les preuves de charge et de reprise de l'ensemble deploye restent
distinctes des tests locaux.
