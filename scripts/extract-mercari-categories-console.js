/**
 * Mercari Category Extractor - Browser Console Version
 * 
 * INSTRUCTIONS:
 * 1. Go to https://www.mercari.com/categories/
 * 2. Click on a top-level category (e.g., "Women")
 * 3. Wait for all subcategories to load
 * 4. Open browser console (F12)
 * 5. Paste this entire script and press Enter
 * 6. Copy the output and use it in MERCARI_CATEGORIES
 */

(function() {
  console.log('🔍 Extracting Mercari categories...\n');
  
  const result = {};
  
  // Find all L1 categories (main subcategories)
  const l1Categories = document.querySelectorAll('[data-testid="L1CategoryRow"]');
  
  l1Categories.forEach(l1Element => {
    const l1Id = l1Element.getAttribute('data-categoryid');
    const l1Name = l1Element.querySelector('.components__SubTitle-sc-4656e523-5')?.textContent.trim();
    
    if (!l1Id || !l1Name) return;
    
    // Find the subcategory container that follows this L1 category
    let nextSibling = l1Element.parentElement.nextElementSibling;
    const l2Categories = {};
    
    if (nextSibling && nextSibling.classList.contains('Container-sc-beaovl')) {
      // This container has L2 categories
      const l2Elements = nextSibling.querySelectorAll('[data-testid="L2CategoryRow"]');
      
      l2Elements.forEach(l2Element => {
        const l2Id = l2Element.getAttribute('data-categoryid');
        const l2Name = l2Element.querySelector('.components__SubTitle-sc-4656e523-5')?.textContent.trim();
        
        if (l2Id && l2Name) {
          l2Categories[l2Id] = {
            id: l2Id,
            name: l2Name
          };
        }
      });
    }
    
    result[l1Id] = {
      id: l1Id,
      name: l1Name,
      ...(Object.keys(l2Categories).length > 0 ? { subcategories: l2Categories } : {})
    };
  });
  
  // Format output
  console.log('='.repeat(80));
  console.log('COPY THIS INTO YOUR MERCARI_CATEGORIES OBJECT:');
  console.log('='.repeat(80));
  console.log('\n');
  
  // Pretty print the result
  const formatted = JSON.stringify(result, null, 2)
    .replace(/"id":/g, 'id:')
    .replace(/"name":/g, 'name:')
    .replace(/"subcategories":/g, 'subcategories:')
    .replace(/"/g, '"'); // Keep quotes around values
  
  console.log(formatted);
  
  console.log('\n');
  console.log('='.repeat(80));
  console.log(`✅ Extracted ${Object.keys(result).length} L1 categories`);
  
  let totalL2 = 0;
  Object.values(result).forEach(cat => {
    if (cat.subcategories) {
      totalL2 += Object.keys(cat.subcategories).length;
    }
  });
  console.log(`✅ Extracted ${totalL2} L2 categories`);
  console.log('='.repeat(80));
  
  // Also save to clipboard if available
  if (navigator.clipboard) {
    navigator.clipboard.writeText(formatted).then(() => {
      console.log('\n📋 Output copied to clipboard!');
    });
  }
  
  return result;
})();

