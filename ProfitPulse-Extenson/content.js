chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "RUN_AUTOFILL") {
    autofillFacebook(msg.listing);
  }
});

function autofillFacebook(listing) {
  const tryFill = () => {
    try {
      const title = document.querySelector('[aria-label="Title"]');
      const price = document.querySelector('[aria-label="Price"]');
      const desc = document.querySelector('[aria-label="Describe your item"]');

      if (title) title.value = listing.title;
      if (price) price.value = listing.price;
      if (desc) desc.value = listing.description;

      console.log("Autofill complete!");
    } catch (e) {
      // Retry until FB fields are ready
      setTimeout(tryFill, 900);
    }
  };
  tryFill();
}
