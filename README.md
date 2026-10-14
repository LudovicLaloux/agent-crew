<div align="center">

# agent-crew

**Vos agents Claude Code travaillent en parallèle. Maintenant, vous les voyez.**

<img src="assets/crew.svg" alt="Sept Clawd en pixel art, chacun déguisé selon son type d'agent : pirate, détective, chef, pilote, astronaute, ingénieur, et un en civil" width="100%">

</div>

Quand Claude Code lance plusieurs sous-agents, ils travaillent en silence : on ne sait pas combien tournent, ce qu'ils font ni lequel traîne. **agent-crew** les rend visibles, avec un petit Clawd en pixel art par agent, déguisé selon son métier.

## Ce que vous obtenez

**Un bandeau au-dessus du prompt**, seulement quand des agents tournent : le décompte (« 3 agents en parallèle · 1 terminé ›»), puis une pastille par agent avec son Clawd, son nom, son temps écoulé et l'outil en cours, sur une seule ligne (`+N` quand ils ne tiennent plus). Un clic sur le décompte ouvre le panneau d'équipe.

**Un panneau d'équipe**, qui s'ouvre tout seul au premier agent lancé (`/agents` pour le rouvrir) :

- un Clawd par agent, qui **marche et anime son accessoire** tant qu'il travaille ;
- il **ferme les yeux** une fois sa tâche terminée, et a les **yeux en croix** s'il échoue ;
- à côté : sa description, son type, son temps écoulé, son nombre d'appels d'outils et l'outil en cours.

**Une notification** quand toute l'équipe a fini.

## Les costumes

| Type d'agent | Costume | Pendant qu'il travaille |
|---|---|---|
| `Explore`, search, grep | 🏴‍☠️ Pirate | ferraille avec son sabre |
| reviewer, checker, audit, security | 🔍 Détective | balaie le code à la loupe |
| `Plan`, architect | 🍳 Chef | fait sauter l'omelette |
| prototyper, `web-fetch` | 🏁 Pilote | court deux fois plus vite, drapeau au vent |
| docs, research, writer | 🚀 Astronaute | flotte en apesanteur, l'antenne clignote |
| engineer, developer, devops | 🔧 Ingénieur | serre un boulon |
| tous les autres | 🦀 En civil | marche, tout simplement |

Chaque agent garde sa propre couleur, portée par son costume. Les animations sont en CSS pur et s'arrêtent si votre système demande de réduire les animations.

## Installation

```sh
claude plugin marketplace add LudovicLaloux/agent-crew
claude plugin install agent-crew@agent-crew
```

Ouvrez ensuite une nouvelle session, puis lancez quelques agents en parallèle, par exemple : *« Lance 3 agents Explore en parallèle pour cartographier ce repo »*.

Les Clawd s'affichent dans l'app de bureau (onglet Code). Dans le terminal, ils deviennent des visages en texte : `◖•ᴗ•◗` au travail, `◖ᵔᴗᵔ◗` terminé, `◖×_×◗` en échec.

**Mettre à jour :**

```sh
claude plugin marketplace update agent-crew
claude plugin update agent-crew@agent-crew
```

**Désinstaller :** `claude plugin uninstall agent-crew@agent-crew`

L'interface est en français.

## Contribuer

Le mod tient dans un seul fichier, [`hooks/register.tsx`](hooks/register.tsx). Les costumes sont dessinés pixel par pixel avec de petites grilles de caractères, faciles à modifier ou à compléter.

```sh
claude --plugin-dir .      # tester sans installer
claude plugin validate .
claude plugin test .
```

Pensez à monter `version` dans [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) à chaque modification : une installation garde une copie en cache, que `claude plugin update` ne rafraîchit qu'à une nouvelle version.

## Crédits

Le Clawd en pixel art, ses costumes et leurs animations sont repris de [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) de johnnyvizz (MIT), lui-même tracé d'après DockCrab.

## Licence

MIT, voir [LICENSE](LICENSE).

Clawd est la mascotte d'Anthropic. agent-crew est un mod communautaire non officiel, sans lien avec Anthropic.
