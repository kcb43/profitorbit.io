async function fileToBase64DataUrl(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
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




