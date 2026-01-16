import newApiClient from "@/api/newApiClient";

/**
 * Sales API (Supabase-backed)
 *
 * Wrapper around `/api/sales` via `newApiClient`.
 * Purpose: stop referencing `base44.entities.Sale.*` throughout the UI.
 */
export const salesApi = {
  get(id) {
    return newApiClient.entities.Sale.get(id);
  },

  list(sort = null, query = null) {
    return newApiClient.entities.Sale.list(sort, query);
  },

  create(data) {
    return newApiClient.entities.Sale.create(data);
  },

  update(id, patch) {
    return newApiClient.entities.Sale.update(id, patch);
  },

  delete(id, hard = false) {
    return newApiClient.entities.Sale.delete(id, hard);
  },
};

export default salesApi;


