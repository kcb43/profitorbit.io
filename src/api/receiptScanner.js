/**
 * Placeholder receipt scanning integration.
 *
 * Replace this with a real receipt/OCR provider such as:
 * - Veryfi OCR API (https://www.veryfi.com/products/ocr-api/)
 * - Tabscanner (https://www.tabscanner.com/)
 * - Mindee Receipts OCR (https://mindee.com/)
 *
 * Each provider typically returns structured data (merchant name, total, date, line items).
 * Map those fields into the inventory form inside `handleReceiptScan`.
 */
export async function scanReceiptPlaceholder(file) {
  console.warn(
    "[ReceiptScanner] No receipt OCR provider configured. Returning mock data. Replace with a real API integration."
  );

  // Simulate network delay.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    item_name: "",
    purchase_price: "",
    purchase_date: "",
    source: "",
    category: "",
    notes: "",
  };
}



