import assert from "node:assert/strict";
import test from "node:test";

import {
  FLASH_PUBLIC_FEED_LIMIT,
  sortFlashPublicFeed,
  selectFlashPublicFeedPage,
} from "../shared/flash-public-feed.ts";

function item(importance, publishedAt, tag) {
  return { importance, publishedAt: new Date(publishedAt), tag };
}

test("trie par importance decroissante : urgente avant importante avant normale", () => {
  const sorted = sortFlashPublicFeed([
    item("normale", "2026-09-05T10:00:00.000Z", "n"),
    item("urgente", "2026-09-05T09:00:00.000Z", "u"),
    item("importante", "2026-09-05T09:30:00.000Z", "i"),
  ]);
  assert.deepEqual(sorted.map((entry) => entry.tag), ["u", "i", "n"]);
});

test("a importance egale, la date la plus recente passe en premier", () => {
  const sorted = sortFlashPublicFeed([
    item("importante", "2026-09-05T08:00:00.000Z", "plus-ancienne"),
    item("importante", "2026-09-05T10:00:00.000Z", "plus-recente"),
  ]);
  assert.deepEqual(sorted.map((entry) => entry.tag), ["plus-recente", "plus-ancienne"]);
});

test("ne mute jamais le tableau d'entree", () => {
  const input = [item("normale", "2026-09-05T08:00:00.000Z", "a")];
  const sorted = sortFlashPublicFeed(input);
  assert.notEqual(sorted, input);
  assert.deepEqual(input.map((entry) => entry.tag), ["a"]);
});

test("un tableau vide reste vide, jamais de faux contenu de remplissage", () => {
  assert.deepEqual(selectFlashPublicFeedPage([]), []);
});

test("borne au nombre maximal, en gardant les plus importantes puis les plus recentes", () => {
  const items = Array.from({ length: FLASH_PUBLIC_FEED_LIMIT + 5 }, (_, index) =>
    item("normale", new Date(2026, 8, 5, 0, index).toISOString(), `entry-${index}`)
  );
  const page = selectFlashPublicFeedPage(items);
  assert.equal(page.length, FLASH_PUBLIC_FEED_LIMIT);
  assert.equal(page[0].tag, `entry-${FLASH_PUBLIC_FEED_LIMIT + 4}`);
});
