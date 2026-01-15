async function fileToBase64DataUrl(file) {
  if (!file) throw new Error("No file selected");
  // Keep client-side errors explicit so “nothing happens” is never silent.
  if (typeof file.size === "number" && file.size > 7_500_000) {
    throw new Error("Receipt image is too large. Please upload a smaller image (under ~7MB).");
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read receipt file on this device/browser."));
    reader.readAsDataURL(file);
  });
  return String(base64);
}

export async function scanReceipt(file) {
  const imageBase64 = await fileToBase64DataUrl(file);
  const resp = await fetch('/api/receipt/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      fileName: file?.name || undefined,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Scan failed' }));
    throw new Error(err.error || 'Receipt scan failed');
  }
  return resp.json();
}




