import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [source, publicClient] = await Promise.all([
  readFile(new URL("./test-preview-support-assistant-routing-review.mjs", import.meta.url), "utf8"),
  readFile(new URL("./test-preview-routing-review-client.mjs", import.meta.url), "utf8"),
]);

assert.match(source, /CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE/);
assert.match(source, /projectRefFromUrl\(supabaseUrl\)/);
assert.match(source, /expectedRef, productionRef/);
assert.match(source, /SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED/);
assert.match(source, /Vercel redacted secret placeholders are refused/);
assert.match(source, /lyceegest-\[a-z0-9-\]\+-safe-scol\\\.vercel\\\.app/);
assert.match(source, /@example\.test/);
assert.match(source, /support_requests/);
assert.match(source, /support_assistant_routing_reviews/);
assert.doesNotMatch(source, /pgmq|support_jobs|BREVO/i);
assert.match(source, /auth\.mfa\.enroll/);
assert.match(source, /currentLevel, "aal2"/);
assert.match(source, /routingDecision: "confirmed"/);
assert.match(source, /assignedTeam: "secretariat"/);
assert.match(source, /routingReview\?\.status, "confirmed"/);
assert.match(source, /routingReview\?\.status, "corrected"/);
assert.match(source, /await deleteRequestFixtures\(\)/);
assert.match(source, /institution_memberships[\s\S]+\.delete\(\)/);
assert.match(source, /admin\.auth\.admin\.deleteUser/);
assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:accessToken|password|email|public_code)/);
assert.doesNotMatch(publicClient, /SUPABASE_SERVICE_ROLE_KEY|auth\.admin|(?:admin|client)\.from\(/);
assert.match(publicClient, /CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE/);
assert.match(publicClient, /currentLevel, "aal2"/);
assert.match(publicClient, /routingDecision: "confirmed"/);
assert.match(publicClient, /assignedTeam: "secretariat"/);
assert.match(publicClient, /cleanup: "external_required"/);
assert.doesNotMatch(publicClient, /console\.(?:log|error)\([^\n]*(?:accessToken|password|email|confirmCode|correctCode)/);

console.log("preview routing review recipe safety: 27/27 checks passed");
