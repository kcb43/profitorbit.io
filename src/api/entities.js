import { apiClient } from './base44Client';


export const Sale = apiClient.entities.Sale;

export const InventoryItem = apiClient.entities.InventoryItem;

export const ImageEditorTemplate = apiClient.entities.ImageEditorTemplate;

// Crosslisting entity - for Chrome extension integration
export const Crosslisting = apiClient.entities.Crosslisting || null;



// auth sdk:
export const User = apiClient.auth;
