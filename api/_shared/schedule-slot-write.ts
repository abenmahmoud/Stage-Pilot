// Point d'écriture unique de `schedule_slots` — LOT 1 du plan du 6 septembre
// 2026 (`docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`).
//
// Avant ce module, aucun code n'écrivait dans `schedule_slots` : le circuit
// d'import montait jusqu'aux pages vérifiées puis s'arrêtait. C'est pour cela
// que l'agent ne donnait jamais de cours.
//
// N'écrit que pour une page déjà vérifiée par un humain (`review_status =
// 'verified'`) et tant que la version source est encore modifiable (`status =
// 'review'`) : la vérification par page reste la seule preuve humaine que le
// contenu correspond au PDF déposé. Chaque appel remplace intégralement les
// créneaux existants de cette page (delete puis insert dans la même
// transaction) : un renvoi corrige, il ne duplique jamais.
//
// Volontairement agnostique de la connexion (`tx.execute` uniquement) : les
// routes API appellent `db.transaction(tx => ...)`, la recette locale
// construit sa propre connexion Postgres jetable, jamais distante.

import { sql, type SQL } from "drizzle-orm";

export type ScheduleTx = { execute: (query: SQL) => Promise<unknown> };

// Erreur locale, volontairement indépendante de `./auth.js` : ce module doit
// rester importable par une recette locale sans initialiser le client
// Supabase (et donc sans variables d'environnement). Les routes API la
// traduisent en `HttpError`.
export class ScheduleSlotWriteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function rowsOf<T>(result: unknown): T[] {
  return Array.from(result as unknown as T[]);
}

export type ScheduleSlotWriteRow = {
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  weekPattern: string | null;
  groupRef: string | null;
};

export type ScheduleSlotWriteResult = {
  id: string;
  classRef: string | null;
  groupRef: string | null;
  teacherRef: string | null;
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  weekPattern: string | null;
};

type PageRow = {
  page_number: number;
  subject_type: "class" | "teacher";
  subject_ref: string;
  review_status: string;
  source_status: string;
};

type InsertedRow = {
  id: string;
  class_ref: string | null;
  group_ref: string | null;
  teacher_ref: string | null;
  subject_code: string;
  subject_label: string;
  room_code: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  week_pattern: string | null;
};

export async function writeScheduleSlots(
  tx: ScheduleTx,
  params: {
    institutionId: string;
    sourceVersionId: string;
    pageIndexId: string;
    actorId: string;
    rows: ScheduleSlotWriteRow[];
  }
): Promise<ScheduleSlotWriteResult[]> {
  await tx.execute(sql`
    select pg_advisory_xact_lock(hashtextextended(${params.sourceVersionId}::text, 61744))
  `);

  const [page] = rowsOf<PageRow>(
    await tx.execute(sql`
      select p.page_number, p.subject_type, p.subject_ref, p.review_status, v.status as source_status
      from public.schedule_page_indexes p
      join public.schedule_source_versions v
        on v.id = p.source_version_id and v.institution_id = p.institution_id
      where p.id = ${params.pageIndexId}
        and p.source_version_id = ${params.sourceVersionId}
        and p.institution_id = ${params.institutionId}
      limit 1
    `)
  );
  if (!page) throw new ScheduleSlotWriteError(404, "Page indexée introuvable.");
  if (page.source_status !== "review") {
    throw new ScheduleSlotWriteError(409, "Cette version n'est plus modifiable.");
  }
  if (page.review_status !== "verified") {
    throw new ScheduleSlotWriteError(409, "La page doit d'abord être vérifiée.");
  }

  const classRef = page.subject_type === "class" ? page.subject_ref : null;
  const teacherRef = page.subject_type === "teacher" ? page.subject_ref : null;

  await tx.execute(sql`
    delete from public.schedule_slots
    where source_version_id = ${params.sourceVersionId}
      and institution_id = ${params.institutionId}
      and coalesce(class_ref, '') = ${classRef ?? ""}
      and coalesce(teacher_ref, '') = ${teacherRef ?? ""}
  `);

  const inserted: InsertedRow[] = [];
  for (const row of params.rows) {
    const [savedRow] = rowsOf<InsertedRow>(
      await tx.execute(sql`
        insert into public.schedule_slots
          (institution_id, source_version_id, class_ref, group_ref, teacher_ref,
           subject_code, subject_label, room_code, starts_at, ends_at, week_pattern,
           parse_confidence, review_status, reviewed_by, reviewed_at)
        values (
          ${params.institutionId}, ${params.sourceVersionId}, ${classRef}, ${row.groupRef}, ${teacherRef},
          ${row.subjectCode}, ${row.subjectLabel}, ${row.roomCode},
          ${row.startsAt}::timestamptz, ${row.endsAt}::timestamptz, ${row.weekPattern},
          1, 'approved', ${params.actorId}, now()
        )
        returning id, class_ref, group_ref, teacher_ref, subject_code, subject_label,
          room_code, starts_at, ends_at, week_pattern
      `)
    );
    inserted.push(savedRow);
  }

  await tx.execute(sql`
    insert into public.schedule_audit
      (institution_id, source_version_id, page_index_id, action, actor_id, summary)
    values (
      ${params.institutionId}, ${params.sourceVersionId}, ${params.pageIndexId}, 'write_slots', ${params.actorId},
      ${JSON.stringify({
        pageNumber: page.page_number,
        subjectType: page.subject_type,
        subjectRef: page.subject_ref,
        rowCount: inserted.length,
      })}::jsonb
    )
  `);

  return inserted.map((row) => ({
    id: row.id,
    classRef: row.class_ref,
    groupRef: row.group_ref,
    teacherRef: row.teacher_ref,
    subjectCode: row.subject_code,
    subjectLabel: row.subject_label,
    roomCode: row.room_code,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    weekPattern: row.week_pattern,
  }));
}
