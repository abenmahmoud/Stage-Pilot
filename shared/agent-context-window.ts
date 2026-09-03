// Ce que l'agent voit reellement : la fenetre de conversation transmise au
// modele, et la requete documentaire.
//
// Deux constats de l'etude du 3 septembre 2026 sont corriges ici.
//
// 1. L'interface accepte jusqu'a 21 messages, mais le modele n'en recevait que
//    dix (`messages.slice(-10)`). Sur une conversation longue, le besoin
//    initial sortait de la fenetre et le modele repondait sur les seules
//    precisions, sans savoir de quoi il s'agissait.
// 2. La recherche documentaire n'utilisait que le DERNIER message du
//    demandeur. « Et pour le badge ? » ne contient aucun terme cherchable ;
//    la recherche partait alors a vide.
//
// La reponse n'est pas d'envoyer tout : c'est de garder le besoin initial, les
// echanges recents, et de traiter explicitement le cas ou le sujet change.

import { knowledgeQueryTokens } from "./knowledge-query.js";

export type AgentConversationMessage = {
  role: "requester" | "assistant";
  content: string;
};

export const AGENT_CONTEXT_LIMITS = Object.freeze({
  /** Aligne sur SUPPORT_ASSISTANT_INPUT_LIMITS.messages : ce qui est accepte est ce qui est vu. */
  maxMessages: 21,
  /** Aligne sur SUPPORT_ASSISTANT_INPUT_LIMITS.conversation. */
  maxCharacters: 12_000,
  /** Taille de la requete documentaire envoyee au moteur de recherche. */
  maxQueryCharacters: 1_200,
});

/**
 * Fenetre transmise au modele.
 *
 * Le premier message du demandeur — le besoin initial — est toujours conserve.
 * Le reste de la fenetre est rempli par les echanges les plus recents, dans la
 * limite de caracteres. Quand des messages sont sautes entre les deux, un
 * repere le dit au modele plutot que de laisser croire a une conversation
 * continue.
 */
export function selectAgentModelWindow(
  messages: readonly AgentConversationMessage[],
  limits: { maxMessages: number; maxCharacters: number } = AGENT_CONTEXT_LIMITS
): AgentConversationMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const bounded = messages.length > limits.maxMessages
    ? messages.slice(-limits.maxMessages)
    : [...messages];

  // On remplit d'abord par la fin : les echanges recents ne sont jamais ceux
  // qu'on sacrifie.
  const tail: AgentConversationMessage[] = [];
  let budget = limits.maxCharacters;
  let firstKept = bounded.length;
  for (let index = bounded.length - 1; index >= 0; index -= 1) {
    const message = bounded[index];
    if (message.content.length > budget) break;
    budget -= message.content.length;
    tail.unshift(message);
    firstKept = index;
  }

  // Rien n'a ete coupe : la fenetre est la conversation elle-meme.
  if (firstKept === 0) return tail;

  const anchorIndex = bounded.findIndex((message) => message.role === "requester");
  if (anchorIndex < 0 || anchorIndex >= firstKept) {
    // Le besoin initial est deja dans la fenetre, ou il n'y a aucun message du
    // demandeur a conserver.
    if (tail.length === 0) return [bounded[bounded.length - 1]];
    return tail;
  }

  const anchor = bounded[anchorIndex];
  const skipped = firstKept - anchorIndex - 1;
  if (skipped <= 0) return [anchor, ...tail];
  return [
    anchor,
    { role: "assistant", content: "[" + skipped + " message(s) plus ancien(s) non transmis]" },
    ...tail,
  ];
}

export type KnowledgeSearchQuery = {
  query: string;
  /** Vrai quand le dernier message ne partage aucun concept avec ce qui precede. */
  topicChanged: boolean;
  concepts: string[];
};

function conceptsOf(text: string): string[] {
  return knowledgeQueryTokens(text).filter((token) => /^[a-z][a-z_]+$/.test(token) && token.includes("_"));
}

/**
 * Requete documentaire contextualisee.
 *
 * Cas normal : le besoin initial et le dernier message sont combines, parce
 * qu'une precision seule ne se cherche pas.
 *
 * Changement de sujet : si le dernier message porte des concepts et qu'AUCUN
 * n'apparait avant, on ne traine pas l'ancien sujet — la recherche part sur le
 * nouveau seul. C'est la difference entre « et pour le badge ? » (precision) et
 * « autre chose : la cantine » (nouveau sujet).
 */
export function buildKnowledgeSearchQuery(
  messages: readonly AgentConversationMessage[],
  limits: { maxQueryCharacters: number } = AGENT_CONTEXT_LIMITS
): KnowledgeSearchQuery {
  const requester = (messages ?? []).filter((message) => message.role === "requester");
  if (requester.length === 0) return { query: "", topicChanged: false, concepts: [] };

  const latest = requester[requester.length - 1].content;
  const earlier = requester.slice(0, -1).map((message) => message.content);

  const latestConcepts = conceptsOf(latest);
  const earlierConcepts = new Set(earlier.flatMap(conceptsOf));
  const topicChanged =
    latestConcepts.length > 0 &&
    earlierConcepts.size > 0 &&
    latestConcepts.every((concept) => !earlierConcepts.has(concept));

  const parts = topicChanged ? [latest] : [...(earlier.length > 0 ? [earlier[0]] : []), ...earlier.slice(1), latest];

  // On construit depuis la fin : la precision la plus recente ne doit jamais
  // etre celle qu'on coupe.
  const kept: string[] = [];
  let budget = limits.maxQueryCharacters;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index].trim();
    if (part.length === 0) continue;
    if (part.length + 1 > budget) continue;
    budget -= part.length + 1;
    kept.unshift(part);
  }

  const query = kept.join("\n");
  return {
    query,
    topicChanged,
    concepts: [...new Set(conceptsOf(query))].sort(),
  };
}
