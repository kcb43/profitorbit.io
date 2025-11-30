// Listens for messages from your Next.js app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "START_FACEBOOK_AUTOFILL") {
    // Forward the listing data to all Facebook tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url.includes("facebook.com/marketplace/create/item")) {
          chrome.tabs.sendMessage(tab.id, {
            type: "RUN_AUTOFILL",
            listing: message.payload,
          });
        }
      });
    });

    sendResponse({ ok: true });
  }
});
