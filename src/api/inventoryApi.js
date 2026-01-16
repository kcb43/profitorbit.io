import newApiClient from "@/api/newApiClient";

/**
 * Inventory API (Supabase-backed)
 *
 * Goal: stop referencing `base44.entities.InventoryItem.*` throughout the UI.
 * This wrapper calls our existing `/api/inventory` route via `newApiClient`.
 *
 * NOTE: This is intentionally small. We’ll expand similarly for `salesApi`, etc. in later steps.
 */
export const inventoryApi = {
  get(id) {
    return newApiClient.entities.InventoryItem.get(id);
  },

  list(sort = null, query = null) {
    return newApiClient.entities.InventoryItem.list(sort, query);
  },

  create(data) {
    return newApiClient.entities.InventoryItem.create(data);
  },

  update(id, patch) {
    return newApiClient.entities.InventoryItem.update(id, patch);
  },

  delete(id, hard = false) {
    return newApiClient.entities.InventoryItem.delete(id, hard);
  },
};

export default inventoryApi;


