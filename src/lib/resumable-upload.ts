import * as tus from "tus-js-client";

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
};

function resumableEndpoint(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const url = new URL(raw);
  if (url.hostname.endsWith(".supabase.co")) {
    const projectRef = url.hostname.slice(0, -".supabase.co".length);
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

export function uploadKnowledgeDocument(
  file: File,
  target: SignedUpload,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: resumableEndpoint(),
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { "x-signature": target.token },
      metadata: {
        bucketName: target.bucket,
        objectName: target.path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "0",
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      },
      onError(error) {
        reject(error);
      },
      onSuccess() {
        onProgress(100);
        resolve();
      },
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
}
