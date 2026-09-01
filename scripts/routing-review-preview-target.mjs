const PREVIEW_PROJECT = "xijocumlwivhbmffrnlj";
const PRODUCTION_PROJECT = "sfqhxiamhgsbbogluqtq";

export function assertRoutingReviewPreviewTarget({ supabaseUrl, expectedRef, productionRef, deploymentHost }) {
  if (supabaseUrl !== `https://${PREVIEW_PROJECT}.supabase.co`
    || expectedRef !== PREVIEW_PROJECT || productionRef !== PRODUCTION_PROJECT
    || typeof deploymentHost !== "string"
    || !/^lyceegest-[a-z0-9]{1,32}-safe-scol\.vercel\.app$/u.test(deploymentHost)) {
    throw new Error("routing_review_preview_target_invalid");
  }
}
