export async function closeRoutingReviewFixtureSession(client, factorId) {
  let complete = true;
  if (factorId) {
    try {
      const result = await client.auth.mfa.unenroll({ factorId });
      if (result.error) complete = false;
    } catch {
      complete = false;
    }
  }
  try {
    const result = await client.auth.signOut({ scope: "local" });
    if (result.error) complete = false;
  } catch {
    complete = false;
  }
  return complete;
}
