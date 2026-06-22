import { supabase } from "./supabase";

/**
 * Upload a File/Blob to a public Supabase Storage bucket and return its
 * public URL. Path should be unique (e.g. `${userId}/${Date.now()}.png`).
 */
export async function uploadToBucket(
  bucket: string,
  path: string,
  body: Blob | File,
  contentType?: string
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    upsert: true,
    contentType: contentType ?? (body instanceof File ? body.type : "image/png"),
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Convert a data URL (e.g. from canvas.toDataURL) into a Blob for upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
