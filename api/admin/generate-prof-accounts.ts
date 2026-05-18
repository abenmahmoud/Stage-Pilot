import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    const linked = await db.execute<{ id: string }>(sql`
      WITH profs_a_creer AS (
        SELECT
          id,
          nom,
          prenom,
          code_acces,
          lower(regexp_replace(code_acces, '[^A-Za-z0-9-]', '', 'g')) || '@prof.lyceegest.local' AS login_email
        FROM professeurs
        WHERE code_acces IS NOT NULL
          AND auth_user_id IS NULL
      ),
      inserted AS (
        INSERT INTO auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          email_change,
          email_change_token_new,
          recovery_token
        )
        SELECT
          '00000000-0000-0000-0000-000000000000'::uuid,
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          login_email,
          crypt(upper(code_acces), gen_salt('bf')),
          now(),
          jsonb_build_object(
            'provider', 'email',
            'providers', array['email'],
            'role', 'professeur',
            'prof_id', id::text
          ),
          jsonb_build_object('full_name', nom || ' ' || prenom),
          now(),
          now(),
          '',
          '',
          '',
          ''
        FROM profs_a_creer p
        WHERE NOT EXISTS (
          SELECT 1
          FROM auth.users u
          WHERE lower(u.email) = p.login_email
        )
        RETURNING id, raw_app_meta_data->>'prof_id' AS prof_id
      ),
      existing AS (
        SELECT u.id, p.id::text AS prof_id
        FROM profs_a_creer p
        INNER JOIN auth.users u ON lower(u.email) = p.login_email
      ),
      all_accounts AS (
        SELECT id, prof_id FROM inserted
        UNION
        SELECT id, prof_id FROM existing
      )
      UPDATE professeurs
      SET auth_user_id = all_accounts.id
      FROM all_accounts
      WHERE professeurs.id::text = all_accounts.prof_id
      RETURNING professeurs.id
    `);

    return { created: linked.length };
  });
}
