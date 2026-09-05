// Processus enfant du LOT 4 du plan de publication flash (recette sur
// PostgreSQL réel) : appelle le vrai handler POST
// /api/flash/proposals/[id]/publication depuis SA PROPRE connexion DB
// (module `db/index.js` rechargé dans un process séparé), pour que deux
// publications "simultanées" passent réellement par deux connexions Postgres
// distinctes, comme deux invocations serverless concurrentes. Même motif que
// `flash-recette-decision-worker.mjs` (LOT 7 du plan de persistance). Jamais
// utilisé seul : lancé par scripts/test-local-flash-publication-recette.mjs.

const [flashInfoId, accessToken, targetTimeMsRaw] = process.argv.slice(2);
const targetTimeMs = Number(targetTimeMsRaw);

function createMockResponse() {
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader() {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res._body = data;
      return res;
    },
  };
  return res;
}

const { default: handler } = await import("../api/flash/proposals/[id]/publication.js");

// Attente active courte : les deux processus visent le même instant pour
// maximiser la chance d'une vraie collision sur le verrou `for update`.
while (Date.now() < targetTimeMs) {
  // volontairement vide
}

const req = {
  method: "POST",
  headers: { authorization: `Bearer ${accessToken}` },
  query: { id: flashInfoId },
  body: {},
};
const res = createMockResponse();
await handler(req, res);
process.stdout.write(JSON.stringify({ status: res.statusCode, body: res._body }));
