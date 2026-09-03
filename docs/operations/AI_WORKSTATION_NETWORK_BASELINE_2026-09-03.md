# Poste IA du referent numerique - socle reseau durable

Date du constat : 3 septembre 2026
Perimetre : poste Windows utilise pour Claude Code, Codex/OpenAI, Kimi et le
developpement de LyceeGest.

## Conclusion

Claude Code est installe, le compte Claude Max est authentifie et le CLI atteint
son interface. Le blocage observe ne vient pas d'une installation defaillante :
le reseau courant presente, pour certains domaines, un certificat emis par un
proxy SSL de la Region Ile-de-France dont la chaine de confiance n'est pas
installee sur le poste.

Le comportement est selectif : quelques sites web publics fonctionnent, tandis
que plusieurs domaines d'API et d'IA echouent en validation TLS. Reinstaller les
CLI ne corrigera pas cette situation.

La solution permanente recommandee est une configuration institutionnelle du
reseau et du poste, validee par le service informatique habilite. Aucun
contournement de la securite TLS ne doit etre utilise.

## Mesure du reseau actuel

Le controle strict du 3 septembre 2026 donne `18` echecs sur `29` destinations :

| Famille | Resultat |
| --- | --- |
| Claude | 7 echecs TLS sur 7 destinations |
| OpenAI/Codex | 8 echecs TLS et 1 echec DNS sur 9 destinations |
| Kimi | 5 destinations pretes sur 5 |
| Developpement | 6 destinations pretes sur 8 ; les API GitHub et Vercel echouent en TLS |

Le fait que `github.com` et `vercel.com` soient disponibles alors que
`api.github.com` et `api.vercel.com` sont rejetes confirme un filtrage selectif,
pas une panne generale d'Internet. Le CLI Claude avait auparavant presente pour
`api.anthropic.com` un certificat emis par le proxy SSL de la Region, sans
chaine racine approuvee sur le poste.

Le controle local confirme egalement :

- Node.js `24.14.1`, compatible avec le magasin de certificats systeme ;
- Claude Code `2.1.259`, installation saine et compte Claude Max authentifie ;
- Kimi CLI `1.43.0` ;
- zero certificat racine correspondant au proxy SSL regional dans les magasins
  racine utilisateur et machine ;
- aucune variable `NODE_TLS_REJECT_UNAUTHORIZED`, `NODE_EXTRA_CA_CERTS`,
  `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`, `HTTP_PROXY` ou `HTTPS_PROXY` active.

Aucun certificat, proxy ou parametre global n'a ete modifie pendant ce constat.

## Controle reproductible

Depuis la racine du depot :

```powershell
pwsh -File .\scripts\check-ai-workstation-network.ps1
```

Pour produire un fichier JSON transmissible au support, sans adresse IP, secret,
identite ou contenu utilisateur :

```powershell
pwsh -File .\scripts\check-ai-workstation-network.ps1 -Json |
  Set-Content -Encoding utf8 "$env:USERPROFILE\Desktop\poste-ia-reseau.json"
```

Le script ne se connecte a aucun compte, n'appelle aucun modele et ne consomme
aucun quota. Il controle la resolution DNS, le port TCP 443 et la confiance TLS
stricte. Le code de sortie est `0` quand tous les endpoints obligatoires sont
prets et `2` dans le cas contraire.

## Architecture cible

### 1. Chemin institutionnel principal

Le service reseau de la Region ou son prestataire doit :

1. Autoriser les destinations necessaires sur TCP 443.
2. Autoriser les connexions WebSocket HTTPS utilisees par les interfaces
   conversationnelles.
3. De preference, exclure les domaines publics des fournisseurs IA du
   dechiffrement TLS. Cela evite qu'un intermediaire lise des echanges pouvant
   concerner le travail scolaire.
4. Si l'inspection TLS est obligatoire, fournir le certificat racine officiel,
   son empreinte verifiee par un canal independant et la procedure de
   deploiement centralisee GPO/MDM.

Dans le second cas, le certificat racine officiel doit etre place dans le
magasin de confiance Windows. Le service informatique doit aussi fournir un
bundle PEM maintenu pour les runtimes qui n'utilisent pas directement ce
magasin. Claude Code documente notamment `NODE_EXTRA_CA_CERTS` en complement du
magasin systeme. Cette variable ne doit etre configuree qu'apres reception et
verification du certificat officiel.

### 2. Continuite autorisee

Un second acces reseau dedie et approuve, par exemple une connexion 4G/5G
professionnelle ou un VLAN institutionnel distinct, peut servir de secours.
Il doit etre inscrit dans la politique du lycee et ne doit jamais devenir un
contournement informel des regles de la Region.

### 3. Poste de travail

- Compte Windows nominatif reserve au referent numerique, sans compte partage.
- Chiffrement du disque, verrouillage automatique, mises a jour et protection
  antimalware actives.
- Authentification multifacteur sur les comptes IA, GitHub, Vercel et les
  consoles administratives.
- Gestionnaire de mots de passe ; aucun secret dans Git, un prompt, une capture
  d'ecran ou un fichier de cours.
- Les listes d'eleves, coordonnees, codes ENT et dossiers nominatifs ne sont pas
  envoyes dans Claude, Kimi ou Codex. Pour le developpement et les cours,
  utiliser des donnees fictives ou pseudonymisees.
- Les traitements reels passent par les outils LyceeGest autorises, avec
  minimisation, journalisation et validation humaine.

L'utilisation de donnees relatives a des mineurs doit etre cadree avec la
direction, le delegue a la protection des donnees et les autorites techniques
competentes avant ouverture du poste aux usages reels.

## Destinations a valider

| Famille | Destinations principales |
| --- | --- |
| Claude | `claude.ai`, `claude.com`, `api.anthropic.com`, `platform.claude.com`, `mcp-proxy.anthropic.com`, `downloads.claude.ai`, `code.claude.com` |
| OpenAI/Codex | `chatgpt.com`, `auth.openai.com`, `auth0.openai.com`, `setup.auth.openai.com`, `api.openai.com`, `ws.chatgpt.com`, `desktop.chat.openai.com`, `cdn.oaistatic.com`, `files.oaiusercontent.com` |
| Kimi | `www.kimi.com`, `auth.kimi.com`, `api.kimi.com`, `agent-gw.kimi.com`, `code.kimi.com` |
| Developpement | `github.com`, `api.github.com`, `raw.githubusercontent.com`, `registry.npmjs.org`, `pypi.org`, `vercel.com`, `api.vercel.com`, `supabase.com` |

Cette liste est une base de recette, pas une autorisation generale. Elle doit
etre ajustee selon les journaux du pare-feu et les documentations fournisseurs,
sans ajouter de domaines inconnus par simple supposition.

## Recette d'acceptation

Le poste n'est declare operationnel qu'apres les controles suivants :

- Le script retourne `POSTE IA PRET` et le code `0` sur le reseau principal.
- La chaine de certificats n'affiche plus d'autorite non approuvee.
- Le certificat racine eventuellement deploye correspond exactement a
  l'empreinte fournie par le service informatique sur un canal independant.
- Claude Code passe `claude doctor`, `claude auth status`, puis une requete de
  test sans donnee reelle apres autorisation de consommation du quota.
- Codex reste connecte au moins quinze minutes et les flux WebSocket ne sont ni
  coupes ni reecrits.
- Kimi se connecte a son fournisseur et effectue un test sans donnee reelle.
- GitHub et Vercel fonctionnent aussi par leur API, pas seulement par leur page
  d'accueil.
- Le meme controle est repete apres une modification du proxy, du certificat,
  du pare-feu ou de l'antivirus.

## Message pret pour le support informatique

> Objet : configuration permanente du poste IA du referent numerique
>
> Bonjour,
>
> Le poste du referent numerique doit utiliser Claude Code, Codex/OpenAI, Kimi,
> GitHub, Vercel et Supabase dans le cadre du portail numerique du lycee. Les CLI
> sont installes et les comptes sont valides, mais plusieurs connexions HTTPS
> echouent car le reseau presente un certificat emis par le proxy SSL de la
> Region dont la chaine n'est pas approuvee sur ce poste.
>
> Merci de mettre en place une solution institutionnelle permanente : autoriser
> les destinations jointes sur TCP 443 et les WebSockets HTTPS, et de preference
> exclure ces domaines du dechiffrement TLS. Si l'inspection est obligatoire,
> merci de fournir et deployer par GPO/MDM le certificat racine officiel, avec
> son empreinte verifiee, ainsi qu'un bundle PEM maintenu pour les runtimes Node.
>
> Le rapport JSON joint ne contient ni secret, ni adresse IP, ni donnee d'eleve.
> Une recette conjointe sera realisee avant tout usage avec des donnees reelles.

## Correctifs interdits

Ne jamais utiliser les solutions suivantes, meme temporairement sur le poste de
travail :

- `NODE_TLS_REJECT_UNAUTHORIZED=0` ;
- `curl -k` ou `--insecure` pour un trafic reel ;
- desactivation globale de `strict-ssl` ;
- installation d'un certificat recupere depuis une session interceptee ;
- copie d'un certificat racine non verifie depuis un autre poste ;
- partage des comptes ou des jetons entre eleves et personnels.

Ces manipulations masquent l'erreur au lieu de retablir une chaine de confiance
et peuvent exposer les comptes, les prompts et les donnees du lycee.

## Sources fournisseurs

- [Configuration reseau d'entreprise de Claude Code](https://code.claude.com/docs/en/corporate-proxy)
- [Recommandations reseau officielles OpenAI pour ChatGPT et Codex](https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps)
- [Depot officiel Kimi CLI](https://github.com/MoonshotAI/kimi-cli)
