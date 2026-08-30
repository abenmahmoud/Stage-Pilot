import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const SOURCE_ORIGIN = "https://lycee-blaise-cendrars-sevran.fr";
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_RESPONSE_BYTES = 1_000_000;
export const MAX_METADATA_ITEMS = 500;
const API_ROOT = `${SOURCE_ORIGIN}/wp-json/wp/v2`;
const INVENTORY_URL = new URL("../content/legacy-site/inventory.json", import.meta.url);
const ROUTES = [
  { route: "pages", wordpressType: "page" },
  { route: "posts", wordpressType: "post" },
];

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value = "") {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function assertOfficialUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}: URL invalide`);
  }
  if (url.protocol !== "https:" || url.origin !== SOURCE_ORIGIN) {
    throw new Error(`${label}: origine non autorisee`);
  }
  return url.href;
}

async function readBoundedJson(response, label) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error(`${label}: reponse declaree trop volumineuse`);
  }
  if (!response.body) throw new Error(`${label}: reponse vide`);

  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error(`${label}: reponse trop volumineuse`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`${label}: JSON invalide`);
  }
}

export function validateLiveRows(rows, wordpressType) {
  if (!Array.isArray(rows) || rows.length > 100) {
    throw new Error(`${wordpressType}: collection invalide ou trop grande`);
  }
  const seenIds = new Set();
  const seenSlugs = new Set();
  return rows.map((row, index) => {
    const label = `${wordpressType}[${index}]`;
    if (!Number.isSafeInteger(row?.id) || row.id <= 0) throw new Error(`${label}: id invalide`);
    if (row.type !== wordpressType) throw new Error(`${label}: type inattendu`);
    if (row.status !== "publish") throw new Error(`${label}: statut inattendu`);
    if (typeof row.slug !== "string" || !row.slug || row.slug.length > 200) {
      throw new Error(`${label}: slug invalide`);
    }
    if (seenIds.has(row.id) || seenSlugs.has(row.slug)) throw new Error(`${label}: doublon`);
    seenIds.add(row.id);
    seenSlugs.add(row.slug);

    const modifiedAt = `${row.modified_gmt}Z`;
    if (typeof row.modified_gmt !== "string" || Number.isNaN(Date.parse(modifiedAt))) {
      throw new Error(`${label}: date invalide`);
    }
    const title = cleanText(row.title?.rendered);
    if (!title || title.length > 500) throw new Error(`${label}: titre invalide`);

    return {
      wordpressId: row.id,
      wordpressType,
      originalSlug: row.slug,
      sourceUrl: assertOfficialUrl(row.link, label),
      sourceModifiedAt: modifiedAt,
      title,
    };
  });
}

export function validateDeclaredCount(headers, rows, label) {
  const rawTotal = headers.get("x-wp-total");
  const rawPages = headers.get("x-wp-totalpages");
  if (rawTotal === null || rawPages === null) throw new Error(`${label}: pagination absente`);
  const total = Number(rawTotal);
  const totalPages = Number(rawPages);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(totalPages) || total < 0 || totalPages < 1) {
    throw new Error(`${label}: pagination invalide`);
  }
  if (total > 100 || totalPages !== 1 || total !== rows.length) {
    throw new Error(`${label}: collection incomplete ou trop grande`);
  }
}

export function parsePaginationHeaders(headers, label, maxItems = MAX_METADATA_ITEMS) {
  const rawTotal = headers.get("x-wp-total");
  const rawPages = headers.get("x-wp-totalpages");
  if (rawTotal === null || rawPages === null) throw new Error(`${label}: pagination absente`);
  const total = Number(rawTotal);
  const totalPages = Number(rawPages);
  const maxPages = Math.ceil(maxItems / 100);
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(totalPages) ||
    total < 0 ||
    total > maxItems ||
    totalPages < 1 ||
    totalPages > maxPages
  ) {
    throw new Error(`${label}: pagination invalide ou trop grande`);
  }
  return { total, totalPages };
}

async function fetchJsonPage(route, fields, page, fetchImpl) {
  const url = new URL(`${API_ROOT}/${route}`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("_fields", fields);
  assertOfficialUrl(url.href, route);

  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": "LyceeGest legacy drift check" },
  });
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${route}: type de reponse inattendu`);
  }
  const rows = await readBoundedJson(response, `${route} page ${page}`);
  if (!Array.isArray(rows) || rows.length > 100) throw new Error(`${route}: collection invalide`);
  return { rows, headers: response.headers };
}

async function fetchCollection(route, wordpressType, fetchImpl = fetch) {
  const { rows, headers } = await fetchJsonPage(
    route,
    "id,type,slug,link,title,modified_gmt,status",
    1,
    fetchImpl
  );
  validateDeclaredCount(headers, rows, route);
  return validateLiveRows(rows, wordpressType);
}

async function fetchMetadataCollection(route, fields, fetchImpl = fetch) {
  const firstPage = await fetchJsonPage(route, fields, 1, fetchImpl);
  const pagination = parsePaginationHeaders(firstPage.headers, route);
  const pages = [firstPage.rows];
  for (let page = 2; page <= pagination.totalPages; page += 1) {
    const nextPage = await fetchJsonPage(route, fields, page, fetchImpl);
    const nextPagination = parsePaginationHeaders(nextPage.headers, `${route} page ${page}`);
    if (nextPagination.total !== pagination.total || nextPagination.totalPages !== pagination.totalPages) {
      throw new Error(`${route}: pagination instable`);
    }
    pages.push(nextPage.rows);
  }
  const rows = pages.flat();
  if (rows.length > pagination.total || rows.length > MAX_METADATA_ITEMS) {
    throw new Error(`${route}: collection incoherente`);
  }
  return { rows, declaredTotal: pagination.total };
}

export function validateLiveMediaRows(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_METADATA_ITEMS) {
    throw new Error("media: collection invalide ou trop grande");
  }
  const seenIds = new Set();
  return rows.map((row, index) => {
    const label = `media[${index}]`;
    if (!Number.isSafeInteger(row?.id) || row.id <= 0 || seenIds.has(row.id)) {
      throw new Error(`${label}: id invalide ou duplique`);
    }
    seenIds.add(row.id);
    if (typeof row.slug !== "string" || !row.slug || row.slug.length > 200) {
      throw new Error(`${label}: slug invalide`);
    }
    if (typeof row.mime_type !== "string" || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/iu.test(row.mime_type)) {
      throw new Error(`${label}: type MIME invalide`);
    }
    const modifiedAt = `${row.modified_gmt}Z`;
    if (typeof row.modified_gmt !== "string" || Number.isNaN(Date.parse(modifiedAt))) {
      throw new Error(`${label}: date invalide`);
    }
    const parentId = row.parent === undefined || row.parent === null || row.parent === 0
      ? null
      : row.parent;
    if (parentId !== null && (!Number.isSafeInteger(parentId) || parentId <= 0)) {
      throw new Error(`${label}: parent invalide`);
    }
    const title = cleanText(row.title?.rendered);
    if (title.length > 500) throw new Error(`${label}: titre invalide`);
    return {
      wordpressId: row.id,
      parentId,
      slug: row.slug,
      title,
      mimeType: row.mime_type.toLowerCase(),
      sourceUrl: assertOfficialUrl(row.source_url, label),
      modifiedAt,
    };
  });
}

export function validateLiveCategoryRows(rows) {
  if (!Array.isArray(rows) || rows.length > 100) {
    throw new Error("categories: collection invalide ou trop grande");
  }
  const seenIds = new Set();
  return rows.map((row, index) => {
    const label = `categorie[${index}]`;
    if (!Number.isSafeInteger(row?.id) || row.id <= 0 || seenIds.has(row.id)) {
      throw new Error(`${label}: id invalide ou duplique`);
    }
    seenIds.add(row.id);
    if (typeof row.slug !== "string" || !row.slug || row.slug.length > 200) {
      throw new Error(`${label}: slug invalide`);
    }
    const name = cleanText(row.name);
    if (!name || name.length > 200) throw new Error(`${label}: nom invalide`);
    if (!Number.isSafeInteger(row.count) || row.count < 0) throw new Error(`${label}: compteur invalide`);
    return { id: row.id, slug: row.slug, name, count: row.count };
  });
}

function stableRecord(item) {
  return {
    wordpressId: item.wordpressId,
    wordpressType: item.wordpressType,
    originalSlug: item.originalSlug,
    sourceUrl: assertOfficialUrl(item.sourceUrl, `inventaire ${item.wordpressType}:${item.wordpressId}`),
    sourceModifiedAt: item.sourceModifiedAt,
    title: item.title,
  };
}

export function compareLegacySnapshots(inventoryContents, liveContents) {
  const inventory = inventoryContents.map(stableRecord);
  const live = liveContents.map(stableRecord);
  const keyOf = (item) => `${item.wordpressType}:${item.wordpressId}`;
  const inventoryByKey = new Map(inventory.map((item) => [keyOf(item), item]));
  const liveByKey = new Map(live.map((item) => [keyOf(item), item]));

  if (inventoryByKey.size !== inventory.length || liveByKey.size !== live.length) {
    throw new Error("Doublon de contenu detecte pendant la comparaison");
  }

  const added = live.filter((item) => !inventoryByKey.has(keyOf(item)));
  const removed = inventory.filter((item) => !liveByKey.has(keyOf(item)));
  const changed = live.flatMap((item) => {
    const previous = inventoryByKey.get(keyOf(item));
    if (!previous || JSON.stringify(previous) === JSON.stringify(item)) return [];
    return [{ key: keyOf(item), inventory: previous, live: item }];
  });

  return {
    inventoryCount: inventory.length,
    liveCount: live.length,
    added,
    removed,
    changed,
    hasDrift: added.length > 0 || removed.length > 0 || changed.length > 0,
  };
}

function compareNormalizedRecords(inventoryItems, liveItems, keyOf, normalize) {
  const inventory = inventoryItems.map(normalize);
  const live = liveItems.map(normalize);
  const inventoryByKey = new Map(inventory.map((item) => [keyOf(item), item]));
  const liveByKey = new Map(live.map((item) => [keyOf(item), item]));
  if (inventoryByKey.size !== inventory.length || liveByKey.size !== live.length) {
    throw new Error("Doublon de metadonnees detecte pendant la comparaison");
  }
  const added = live.filter((item) => !inventoryByKey.has(keyOf(item)));
  const removed = inventory.filter((item) => !liveByKey.has(keyOf(item)));
  const changed = live.flatMap((item) => {
    const previous = inventoryByKey.get(keyOf(item));
    if (!previous || JSON.stringify(previous) === JSON.stringify(item)) return [];
    return [{ key: keyOf(item), inventory: previous, live: item }];
  });
  return { inventoryCount: inventory.length, liveCount: live.length, added, removed, changed };
}

function stableMediaRecord(item) {
  return {
    wordpressId: item.wordpressId,
    parentId: item.parentId ?? null,
    slug: item.slug,
    title: item.title,
    mimeType: item.mimeType,
    sourceUrl: assertOfficialUrl(item.sourceUrl, `media ${item.wordpressId}`),
    modifiedAt: item.modifiedAt,
  };
}

export function compareLegacyMediaSnapshots(inventoryMedia, liveMedia, declaredInventory, declaredLive) {
  const result = compareNormalizedRecords(inventoryMedia, liveMedia, (item) => item.wordpressId, stableMediaRecord);
  if (
    !Number.isSafeInteger(declaredInventory) ||
    !Number.isSafeInteger(declaredLive) ||
    declaredInventory < result.inventoryCount ||
    declaredLive < result.liveCount
  ) {
    throw new Error("Compteurs de medias invalides");
  }
  const inaccessibleInventory = declaredInventory - result.inventoryCount;
  const inaccessibleLive = declaredLive - result.liveCount;
  const countDrift =
    declaredInventory !== declaredLive ||
    inaccessibleInventory !== inaccessibleLive;
  return {
    ...result,
    declaredInventory,
    declaredLive,
    inaccessibleInventory,
    inaccessibleLive,
    hasDrift: countDrift || result.added.length > 0 || result.removed.length > 0 || result.changed.length > 0,
  };
}

function stableCategoryRecord(item) {
  return { id: item.id, slug: item.slug, name: item.name, count: item.count };
}

export function compareLegacyCategorySnapshots(
  inventoryCategories,
  liveCategories,
  declaredLive = liveCategories.length
) {
  const result = compareNormalizedRecords(inventoryCategories, liveCategories, (item) => item.id, stableCategoryRecord);
  if (!Number.isSafeInteger(declaredLive) || declaredLive < result.liveCount) {
    throw new Error("Compteur de categories invalide");
  }
  return {
    ...result,
    declaredInventory: result.inventoryCount,
    declaredLive,
    hasDrift:
      declaredLive !== result.inventoryCount ||
      result.added.length > 0 ||
      result.removed.length > 0 ||
      result.changed.length > 0,
  };
}

export async function checkLegacyWordPressDrift({ fetchImpl = fetch } = {}) {
  const inventory = JSON.parse(await readFile(INVENTORY_URL, "utf8"));
  if (inventory.sourceOrigin !== SOURCE_ORIGIN || !Array.isArray(inventory.contents)) {
    throw new Error("Inventaire historique invalide");
  }
  if (!Array.isArray(inventory.media) || !Array.isArray(inventory.categories)) {
    throw new Error("Metadonnees historiques invalides");
  }
  const [liveCollections, mediaCollection, categoryCollection] = await Promise.all([
    Promise.all(ROUTES.map(({ route, wordpressType }) => fetchCollection(route, wordpressType, fetchImpl))),
    fetchMetadataCollection("media", "id,slug,source_url,modified_gmt,mime_type,parent,title", fetchImpl),
    fetchMetadataCollection("categories", "id,slug,name,count", fetchImpl),
  ]);
  const contents = compareLegacySnapshots(inventory.contents, liveCollections.flat());
  const media = compareLegacyMediaSnapshots(
    inventory.media,
    validateLiveMediaRows(mediaCollection.rows),
    inventory.counts?.mediaDeclared,
    mediaCollection.declaredTotal
  );
  const categories = compareLegacyCategorySnapshots(
    inventory.categories,
    validateLiveCategoryRows(categoryCollection.rows),
    categoryCollection.declaredTotal
  );
  return {
    ...contents,
    media,
    categories,
    hasAnyDrift: contents.hasDrift || media.hasDrift || categories.hasDrift,
  };
}

async function main() {
  const result = await checkLegacyWordPressDrift();
  console.log(JSON.stringify(result, null, 2));
  if (result.hasAnyDrift) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
