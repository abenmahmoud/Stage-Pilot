import assert from "node:assert/strict";
import { showParentsMeeting } from "../shared/school-public-information.ts";

// Expiration is Paris midnight after the meeting, never an invented meeting time.
assert.equal(showParentsMeeting(new Date("2026-09-03T23:59:59+02:00")), false);
assert.equal(showParentsMeeting(new Date("2026-09-04T00:00:00+02:00")), true);
assert.equal(showParentsMeeting(new Date("2026-09-22T23:59:59+02:00")), true);
assert.equal(showParentsMeeting(new Date("2026-09-23T00:00:00+02:00")), false);
assert.equal(showParentsMeeting(new Date("2027-09-07T12:00:00+02:00")), false);
assert.equal(showParentsMeeting(new Date(NaN)), false);
console.log("School meeting visibility: 6 boundary checks passed.");
