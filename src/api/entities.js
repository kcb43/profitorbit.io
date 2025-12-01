import { base44 } from './base44Client';


export const Sale = base44.entities.Sale;

export const InventoryItem = base44.entities.InventoryItem;

export const ImageEditorTemplate = base44.entities.ImageEditorTemplate;

// Crosslisting entity - for Chrome extension integration
export const Crosslisting = base44.entities.Crosslisting || null;



// auth sdk:
export const User = base44.auth;
