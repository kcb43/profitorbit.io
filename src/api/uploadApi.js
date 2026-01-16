import { uploadFile as uploadFileImpl } from "@/api/newApiClient";

/**
 * Upload API (Supabase-backed)
 *
 * Wrapper around `/api/upload` (via `newApiClient`’s auth-aware helper).
 * Purpose: remove remaining `base44.integrations.Core.UploadFile` usage.
 */
export const uploadApi = {
  uploadFile({ file }) {
    return uploadFileImpl({ file });
  },
};

export default uploadApi;


