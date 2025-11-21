const CUSTOM_FEE_TOKEN = "[[CustomFees]]";

const normalizeFees = (fees = []) =>
  (Array.isArray(fees) ? fees : [])
    .map((fee, index) => {
      if (!fee) return null;
      const name = typeof fee.name === "string" ? fee.name.trim() : "";
      const amount = typeof fee.amount === "number" ? fee.amount : parseFloat(fee.amount);
      if (!name || Number.isNaN(amount)) return null;
      const id =
        typeof fee.id === "string" && fee.id.trim()
          ? fee.id.trim()
          : `fee-${index}-${Math.random().toString(36).slice(2, 8)}`;
      return { id, name, amount };
    })
    .filter(Boolean);

export const getCustomFeesTotal = (fees = []) =>
  normalizeFees(fees).reduce((sum, fee) => sum + (fee.amount || 0), 0);

export const extractCustomFees = (notes = "") => {
  if (!notes) return { cleanNotes: "", customFees: [] };

  const tokenIndex = notes.lastIndexOf(CUSTOM_FEE_TOKEN);
  if (tokenIndex === -1) {
    return { cleanNotes: notes, customFees: [] };
  }

  const cleanNotes = notes.slice(0, tokenIndex).trimEnd();
  const payload = notes.slice(tokenIndex + CUSTOM_FEE_TOKEN.length).trim();

  try {
    const parsed = JSON.parse(payload);
    const customFees = normalizeFees(parsed);
    return { cleanNotes, customFees };
  } catch (error) {
    console.warn("Failed to parse custom fee payload", error);
    return { cleanNotes: notes, customFees: [] };
  }
};

export const injectCustomFees = (notes = "", fees = []) => {
  const { cleanNotes } = extractCustomFees(notes);
  const sanitizedFees = normalizeFees(fees);

  if (!sanitizedFees.length) {
    return cleanNotes;
  }

  const baseNotes = cleanNotes.trimEnd();
  const serialized = JSON.stringify(sanitizedFees);
  return `${baseNotes}${baseNotes ? "\n\n" : ""}${CUSTOM_FEE_TOKEN}${serialized}`;
};

export const stripCustomFeeNotes = (notes = "") => extractCustomFees(notes).cleanNotes;

export const CUSTOM_FEES_TOKEN = CUSTOM_FEE_TOKEN;

