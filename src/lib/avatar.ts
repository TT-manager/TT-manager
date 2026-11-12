import { supabaseUrl } from "./supabase/env";

/** Indirizzo pubblico della foto profilo (o null se non c'è). */
export const avatarUrl = (path: string | null | undefined) =>
  path ? `${supabaseUrl}/storage/v1/object/public/avatars/${path}` : null;

/** Controlla dai primi byte che il file sia davvero un'immagine WebP o JPEG. */
export function imageKind(bytes: Uint8Array): "webp" | "jpg" | null {
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}
