export function createCommunicationInboundScanRepository(sql) {
  const expectOne = (rows) => { if (rows.length !== 1) throw new Error("inbound_scan_write_conflict"); };
  const expectTrue = (rows) => { if (rows[0]?.ok !== true) throw new Error("inbound_scan_queue_conflict"); };
  return {
    async lease() {
      const [row] = await sql`select msg_id::text as "msgId", read_ct as "readCount"
        from pgmq.read('communication_inbound_scan', 300, 1)`;
      return row ?? null;
    },
    withTransaction(work) {
      return sql.begin(async (tx) => {
        await tx`set local lock_timeout = '5s'`;
        await tx`set local statement_timeout = '10s'`;
        await tx`set local idle_in_transaction_session_timeout = '300s'`;
        return work({
          async lockJob(lease) {
            const [row] = await tx`select message from pgmq.q_communication_inbound_scan
              where msg_id = ${lease.msgId}::bigint and read_ct = ${lease.readCount}
                and vt > clock_timestamp() for update`;
            return row ?? null;
          },
          async lockObject(scope) {
            const [row] = await tx`select status, media_type as "mediaType", size_bytes as "sizeBytes",
                storage_bucket as "storageBucket", storage_path as "storagePath", sha256
              from public.communication_inbound_objects
              where id = ${scope.objectId}::uuid and institution_id = ${scope.institutionId}::uuid
                and inbound_id = ${scope.inboundId}::uuid for update`;
            return row ?? null;
          },
          async setObject(scope, changes) {
            const rows = await tx`update public.communication_inbound_objects
              set status = ${changes.status}, scan_detail = ${changes.scanDetail},
                scanned_at = ${changes.scannedAt},
                storage_bucket = coalesce(${changes.storageBucket ?? null}::text, storage_bucket)
              where id = ${scope.objectId}::uuid and institution_id = ${scope.institutionId}::uuid
                and inbound_id = ${scope.inboundId}::uuid returning id`;
            expectOne(rows);
          },
          async addEvent(scope, eventType, summary) {
            await tx`insert into public.communication_inbound_object_events
              (institution_id, inbound_object_id, actor_type, event_type, summary)
              values (${scope.institutionId}::uuid, ${scope.objectId}::uuid, 'system',
                ${eventType}, ${tx.json(summary)})`;
          },
          async acknowledgeJob(msgId) {
            expectTrue(await tx`select pgmq.delete('communication_inbound_scan', ${msgId}::bigint) as ok`);
          },
          async archiveJob(msgId) {
            expectTrue(await tx`select pgmq.archive('communication_inbound_scan', ${msgId}::bigint) as ok`);
          },
          async retryJob(msgId, seconds) {
            const rows = await tx`select msg_id from pgmq.set_vt('communication_inbound_scan',
              ${msgId}::bigint, ${seconds}::integer)`;
            expectOne(rows);
          },
        });
      });
    },
  };
}
