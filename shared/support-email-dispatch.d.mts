import type { Sql } from "postgres";
import type { SupportEmailQueueJob } from "./support-email-job-policy.js";
export function supportEmailEventKey(job: SupportEmailQueueJob): string;
export function dispatchSupportEmail(database: Sql, job: SupportEmailQueueJob, send: (key: string) => Promise<string>): Promise<string>;
export function supportEmailErrorCode(error: unknown): string;
export function assertSupportEmailAccess(database: Sql, job: SupportEmailQueueJob): Promise<void>;
