import newApiClient from "@/api/newApiClient";

/**
 * Image Editor Templates API (Supabase-backed)
 *
 * Wrapper around `/api/image-templates` via `newApiClient`.
 * Purpose: stop referencing `base44.entities.ImageEditorTemplate.*`.
 */
export const imageEditorTemplatesApi = {
  get(id) {
    return newApiClient.entities.ImageEditorTemplate.get(id);
  },

  list(sort = null, query = null) {
    return newApiClient.entities.ImageEditorTemplate.list(sort, query);
  },

  create(data) {
    return newApiClient.entities.ImageEditorTemplate.create(data);
  },

  update(id, patch) {
    return newApiClient.entities.ImageEditorTemplate.update(id, patch);
  },

  delete(id, hard = false) {
    return newApiClient.entities.ImageEditorTemplate.delete(id, hard);
  },
};

export default imageEditorTemplatesApi;


