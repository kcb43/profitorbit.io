/**
 * Debug Mercari Item Page Structure
 * 
 * Run this in the console WHILE ON A MERCARI ITEM PAGE
 * Example: https://www.mercari.com/us/item/m85955812918/
 */

(async function debugMercariItemPage() {
  console.log('🔍 Debugging Mercari item page structure...');
  
  // Get the __NEXT_DATA__ script tag
  const scriptTags = document.querySelectorAll('script[id="__NEXT_DATA__"]');
  
  if (scriptTags.length === 0) {
    console.error('❌ No __NEXT_DATA__ script tag found!');
    return;
  }
  
  const scriptTag = scriptTags[0];
  const jsonData = JSON.parse(scriptTag.textContent);
  
  console.log('✅ Found __NEXT_DATA__');
  console.log('📦 Full structure keys:', Object.keys(jsonData));
  
  // Navigate to item data
  const pageProps = jsonData?.props?.pageProps;
  console.log('📦 pageProps keys:', pageProps ? Object.keys(pageProps) : 'not found');
  
  const item = pageProps?.item;
  console.log('📦 item keys:', item ? Object.keys(item) : 'not found');
  
  if (item) {
    console.log('\n🔍 SEARCHING FOR DATE FIELDS:');
    console.log('='.repeat(50));
    
    // Show ALL fields that might be related to dates
    const allFields = Object.keys(item);
    const dateRelatedFields = allFields.filter(key => 
      key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('time') ||
      key.toLowerCase().includes('created') ||
      key.toLowerCase().includes('updated') ||
      key.toLowerCase().includes('listed') ||
      key.toLowerCase().includes('posted') ||
      key.toLowerCase().includes('publish')
    );
    
    console.log('📅 Date-related fields found:', dateRelatedFields);
    
    dateRelatedFields.forEach(field => {
      console.log(`\n  ${field}:`, item[field]);
      console.log(`    Type: ${typeof item[field]}`);
      
      // If it's a number, try to convert as timestamp
      if (typeof item[field] === 'number') {
        const asDate = new Date(item[field]);
        const asDateSeconds = new Date(item[field] * 1000);
        console.log(`    As Date (ms): ${asDate.toISOString()}`);
        console.log(`    As Date (seconds): ${asDateSeconds.toISOString()}`);
      }
    });
    
    // Show first 20 fields with their values
    console.log('\n📦 First 20 fields:');
    console.log('='.repeat(50));
    allFields.slice(0, 20).forEach(field => {
      const value = item[field];
      const valuePreview = typeof value === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...'
        : value;
      console.log(`  ${field}: ${JSON.stringify(valuePreview)}`);
    });
    
    // Export full item data
    console.log('\n💾 Full item data exported to window.__debugMercariItem');
    window.__debugMercariItem = item;
    console.log('💡 Type "window.__debugMercariItem" to inspect all fields');
  }
  
  console.log('\n✅ Debug complete!');
})();
