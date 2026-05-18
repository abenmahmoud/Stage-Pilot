import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/**
 * Client DB partagé entre toutes les API routes Vercel.
 *
 * Important : on désactive `prepare` car le pooler Supabase en mode Transaction
 * ne supporte pas les prepared statements (la session change à chaque requête).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL n'est pas défini. Sur Vercel, ajoute la variable dans Project Settings → Environment Variables."
  );
}

const client = postgres(connectionString, {
  prepare: false,
  max: 1, // 1 connexion par instance Lambda = sain pour serverless
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
