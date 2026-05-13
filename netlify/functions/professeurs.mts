import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { professeurs } from "../../db/schema.js";

export default async (req: Request) => {
  if (req.method === "GET") {
    const all = await db.select().from(professeurs);
    return Response.json(all);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/professeurs",
};
