const DATABASE_NAME = "lyceegest-support-device";
const DATABASE_VERSION = 1;
const STORE_NAME = "memory";
const ACTIVE_DRAFT_KEY = "active-support-draft";
const REQUESTS_KEY = "remembered-support-requests";

export const DEVICE_MEMORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type SupportDraftMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type SupportDraftFormValues = {
  requesterFirstName: string;
  requesterLastName: string;
  beneficiaryFirstName: string;
  beneficiaryLastName: string;
  className: string;
  subjectArea: string;
  schoolTrack: string;
  email: string;
  phone: string;
  preferredChannel: "email" | "phone";
  languagePreference: string;
  fallbackAllowed: boolean;
  communicationSupport: boolean;
};

export type SupportDeviceDraft<TInsight = unknown> = {
  requestKey: string;
  chatMessages: SupportDraftMessage[];
  insight: TInsight | null;
  showDetails: boolean;
  classicForm: boolean;
  profile: string;
  category: string;
  classicDescription: string;
  formValues: SupportDraftFormValues;
  hadAttachments: boolean;
  updatedAt: string;
};

export type RememberedSupportRequest = {
  publicCode: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryRecord<T> = {
  key: string;
  value: T;
};

export function isDeviceMemoryFresh(updatedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= DEVICE_MEMORY_RETENTION_MS;
}

function openDeviceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Unable to open device memory"));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readRecord<T>(key: string): Promise<T | null> {
  const database = await openDeviceDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onerror = () => reject(request.error ?? new Error("Unable to read device memory"));
      request.onsuccess = () => resolve((request.result as MemoryRecord<T> | undefined)?.value ?? null);
    });
  } finally {
    database.close();
  }
}

async function writeRecord<T>(key: string, value: T): Promise<void> {
  const database = await openDeviceDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write device memory"));
      transaction.objectStore(STORE_NAME).put({ key, value } satisfies MemoryRecord<T>);
    });
  } finally {
    database.close();
  }
}

async function deleteRecord(key: string): Promise<void> {
  const database = await openDeviceDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clear device memory"));
      transaction.objectStore(STORE_NAME).delete(key);
    });
  } finally {
    database.close();
  }
}

function isDraftMessage(value: unknown): value is SupportDraftMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<SupportDraftMessage>;
  return (message.role === "assistant" || message.role === "requester") &&
    typeof message.content === "string" && message.content.length <= 5_000;
}

function isDraftFormValues(value: unknown): value is SupportDraftFormValues {
  if (!value || typeof value !== "object") return false;
  const form = value as Record<string, unknown>;
  const stringFields = [
    "requesterFirstName",
    "requesterLastName",
    "beneficiaryFirstName",
    "beneficiaryLastName",
    "className",
    "subjectArea",
    "schoolTrack",
    "email",
    "phone",
    "languagePreference",
  ];
  return stringFields.every((field) => typeof form[field] === "string" && String(form[field]).length <= 500) &&
    (form.preferredChannel === "email" || form.preferredChannel === "phone") &&
    typeof form.fallbackAllowed === "boolean" &&
    typeof form.communicationSupport === "boolean";
}

function isSupportDeviceDraft<TInsight>(value: unknown): value is SupportDeviceDraft<TInsight> {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<SupportDeviceDraft<TInsight>>;
  return typeof draft.requestKey === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(draft.requestKey) &&
    Array.isArray(draft.chatMessages) && draft.chatMessages.length <= 30 && draft.chatMessages.every(isDraftMessage) &&
    typeof draft.showDetails === "boolean" &&
    typeof draft.classicForm === "boolean" &&
    typeof draft.profile === "string" && draft.profile.length <= 30 &&
    typeof draft.category === "string" && draft.category.length <= 60 &&
    typeof draft.classicDescription === "string" && draft.classicDescription.length <= 5_000 &&
    isDraftFormValues(draft.formValues) &&
    typeof draft.hadAttachments === "boolean" &&
    typeof draft.updatedAt === "string";
}

function isRememberedRequest(value: unknown): value is RememberedSupportRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<RememberedSupportRequest>;
  return typeof request.publicCode === "string" && /^BC-\d{4}-\d{6}$/.test(request.publicCode) &&
    typeof request.subject === "string" && request.subject.length <= 300 &&
    typeof request.category === "string" && request.category.length <= 80 &&
    typeof request.status === "string" && request.status.length <= 80 &&
    typeof request.priority === "string" && request.priority.length <= 30 &&
    typeof request.createdAt === "string" &&
    typeof request.updatedAt === "string";
}

export async function readSupportDeviceDraft<TInsight>(): Promise<SupportDeviceDraft<TInsight> | null> {
  try {
    const draft = await readRecord<unknown>(ACTIVE_DRAFT_KEY);
    if (!isSupportDeviceDraft<TInsight>(draft) || !isDeviceMemoryFresh(draft.updatedAt)) {
      if (draft) await deleteRecord(ACTIVE_DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function saveSupportDeviceDraft<TInsight>(
  draft: Omit<SupportDeviceDraft<TInsight>, "updatedAt">
): Promise<void> {
  try {
    await writeRecord(ACTIVE_DRAFT_KEY, { ...draft, updatedAt: new Date().toISOString() });
  } catch {
    // The support flow remains usable when private browsing disables IndexedDB.
  }
}

export async function clearSupportDeviceDraft(): Promise<void> {
  try {
    await deleteRecord(ACTIVE_DRAFT_KEY);
  } catch {
    // Nothing else should block because local memory is an optional resilience layer.
  }
}

export async function rememberSupportRequests(requests: RememberedSupportRequest[]): Promise<void> {
  try {
    const existing = await listRememberedSupportRequests();
    const merged = new Map(existing.map((request) => [request.publicCode, request]));
    for (const request of requests) {
      if (isRememberedRequest(request)) merged.set(request.publicCode, request);
    }
    await writeRecord(REQUESTS_KEY, Array.from(merged.values()).slice(-100));
  } catch {
    // The secure server session remains the source of truth.
  }
}

export async function listRememberedSupportRequests(): Promise<RememberedSupportRequest[]> {
  try {
    const requests = await readRecord<unknown>(REQUESTS_KEY);
    if (!Array.isArray(requests)) return [];
    const fresh = requests.filter(isRememberedRequest).filter((request) => isDeviceMemoryFresh(request.updatedAt));
    if (fresh.length !== requests.length) await writeRecord(REQUESTS_KEY, fresh);
    return fresh.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  } catch {
    return [];
  }
}
