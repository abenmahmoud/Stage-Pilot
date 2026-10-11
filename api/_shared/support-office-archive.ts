import { sql, type SQL } from "drizzle-orm";
import { supportRequests } from "../../db/schema.js";

/** Only server-authored archive events can hide a dossier. A new inbound reopens the queue. */
export function officeArchiveFilter(mode: string): SQL | undefined {
  if (mode === "include") return undefined;
  const archived = sql<boolean>`coalesce((
    select evt.event_type = 'request.archived' and not exists (
      select 1 from support_messages as msg
      where msg.request_id = "support_requests"."id"
        and msg.direction = 'inbound' and msg.created_at > evt.created_at
    )
    from support_events as evt
    where evt.request_id = "support_requests"."id"
      and evt.event_type in ('request.archived', 'request.restored')
    order by evt.created_at desc, evt.id desc limit 1
  ), false)`;
  return mode === "only" ? archived : sql`not (${archived})`;
}

export function officeRequestScopeFilter(scope: string, category: string): SQL | undefined {
  // Material stays in its dedicated queue, unless staff explicitly choose it.
  if (scope || category === "ordinateur") return undefined;
  return sql`not (${supportRequests.category} = 'ordinateur' and coalesce(${supportRequests.subcategory}, '') = 'materiel_lycee')`;
}
