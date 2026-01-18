import { uploadFile as uploadFileImpl } from "@/api/newApiClient";
import { standardizeImageForUpload } from "@/utils/standardizeImageForUpload";

/**
 * Upload API (Supabase-backed)
 *
 * Wrapper around `/api/upload` (via `newApiClient`’s auth-aware helper).
 * Purpose: remove remaining `base44.integrations.Core.UploadFile` usage.
 */
export const uploadApi = {
  async uploadFile({ file }) {
    const processed = await standardizeImageForUpload(file);
    return uploadFileImpl({ file: processed });
  },
};

export default uploadApi;


