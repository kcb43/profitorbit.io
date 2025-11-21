type Sale = {
  [key: string]: any;
};

function parseDate(value: unknown): number | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function getTimestamp(sale: Sale, keys: string[]): number {
  for (const key of keys) {
    if (sale && Object.prototype.hasOwnProperty.call(sale, key)) {
      const time = parseDate(sale[key]);
      if (time !== null) {
        return time;
      }
    }
  }
  return 0;
}

const SALE_DATE_KEYS = ["sale_date", "saleDate", "sold_date", "soldDate"];
const CREATED_DATE_KEYS = ["created_date", "createdDate", "created_at", "createdAt"];

export function sortSalesByRecency<T extends Sale>(sales: T[]): T[] {
  if (!Array.isArray(sales)) return [];
  return [...sales].sort((a, b) => {
    const saleTimeA = getTimestamp(a, SALE_DATE_KEYS);
    const saleTimeB = getTimestamp(b, SALE_DATE_KEYS);

    if (saleTimeA !== saleTimeB) {
      return saleTimeB - saleTimeA;
    }

    const createdTimeA = getTimestamp(a, CREATED_DATE_KEYS);
    const createdTimeB = getTimestamp(b, CREATED_DATE_KEYS);

    if (createdTimeA !== createdTimeB) {
      return createdTimeB - createdTimeA;
    }

    return 0;
  });
}



