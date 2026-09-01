import { and, eq, isNull, or } from "drizzle-orm";
import { supportContacts, supportDeviceSessions, supportRequests } from "../../db/schema.js";

export function supportSessionContactPredicate() {
  return or(
    isNull(supportDeviceSessions.accessContactId),
    and(
      eq(supportContacts.id, supportDeviceSessions.accessContactId),
      eq(supportContacts.requestId, supportRequests.id),
      eq(supportContacts.channel, "email"),
      eq(supportContacts.usageScope, "support"),
      isNull(supportContacts.disabledAt)
    )
  );
}

export function supportSessionContactStateAllowsAccess(input: {
  accessContactId: string | null;
  requestId: string;
  contact: null | {
    id: string;
    requestId: string;
    channel: string;
    usageScope: string;
    disabledAt: Date | null;
  };
}): boolean {
  if (input.accessContactId === null) return true;
  return input.contact !== null
    && input.contact.id === input.accessContactId
    && input.contact.requestId === input.requestId
    && input.contact.channel === "email"
    && input.contact.usageScope === "support"
    && input.contact.disabledAt === null;
}
