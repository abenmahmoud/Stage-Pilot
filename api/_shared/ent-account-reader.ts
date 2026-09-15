import { and, eq, inArray, isNull, lte, gte, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { personAttributeImports, personAttributeRows } from '../../db/schema.js';
import { decryptPersonAttributeValue } from '../../shared/person-attribute-crypto.js';
import { validEntAccount, type EntAccount } from '../../shared/ent-self-service.js';
import type { IdentityDeviceSessionContext } from './identity-device-access.js';

export async function readOwnEntAccount(identity: IdentityDeviceSessionContext, today: string, executor: Pick<typeof db,'select'> = db): Promise<EntAccount|null> {
  const rows = await executor.select({ row: personAttributeRows }).from(personAttributeRows)
    .innerJoin(personAttributeImports, and(eq(personAttributeImports.id,personAttributeRows.importId),
      eq(personAttributeImports.institutionId,personAttributeRows.institutionId),
      eq(personAttributeImports.directoryImportId,identity.sourceImportId),eq(personAttributeImports.status,'active')))
    .where(and(eq(personAttributeRows.institutionId,identity.institutionId),eq(personAttributeRows.personRef,identity.personRef),
      inArray(personAttributeRows.attributeKey,['ent_identifier','ent_activation_state']),lte(personAttributeRows.validFrom,today),
      or(isNull(personAttributeRows.validUntil),gte(personAttributeRows.validUntil,today)))).limit(3);
  if (rows.length !== 2 || new Set(rows.map(({row})=>row.attributeKey)).size !== 2) return null;
  const values: Record<string,string> = {};
  for (const {row} of rows) values[row.attributeKey] = decryptPersonAttributeValue({
    envelope:row,institutionId:identity.institutionId,importId:row.importId,rowId:row.id,
    personRef:identity.personRef,attributeKey:row.attributeKey });
  const account = {identifier:values.ent_identifier,activationState:values.ent_activation_state};
  return validEntAccount(account) ? account : null;
}
