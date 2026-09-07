import { supabase } from "./supabase-browser";

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
};

export async function uploadPrivateFile(
  file: File,
  target: SignedUpload,
  onProgress: (percent: number) => void
): Promise<void> {
  onProgress(5);
  const { error } = await supabase.storage
    .from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "0",
    });
  if (error) {
    onProgress(0);
    throw new Error("Le transfert privé a échoué. Réessayez, puis contactez un administrateur si le problème persiste.");
  }
  onProgress(100);
}

export function uploadKnowledgeDocument(
  file: File,
  target: SignedUpload,
  onProgress: (percent: number) => void
): Promise<void> {
  return uploadPrivateFile(file, target, onProgress);
}
