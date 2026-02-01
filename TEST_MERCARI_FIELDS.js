// TEST SCRIPT: Get Mercari API Response Structure
// Run this in the console AFTER clicking "Get Latest Mercari Items"

// This will trigger a sync and show you what fields Mercari actually returns
console.log('=== MERCARI API FIELD DISCOVERY ===\n');

// Override the console.log temporarily to capture the response
const originalLog = console.log;
let capturedData = null;

console.log = function(...args) {
  // Look for the "Sample item from searchQuery" log
  if (args[0] === '📦 Sample item from searchQuery:') {
    capturedData = args[1];
  }
  // Look for the "ALL available fields" log
  if (args[0] === '🔍 ALL available fields in item:') {
    console.info('✅ AVAILABLE FIELDS:', args[1]);
  }
  originalLog.apply(console, args);
};

// Now click "Get Latest Mercari Items" button in the UI
// After it completes, run this in console:

setTimeout(() => {
  console.log = originalLog; // Restore
  
  if (!capturedData) {
    console.error('❌ No data captured. Make sure you clicked "Get Latest Mercari Items" first!');
  } else {
    console.log('\n=== CAPTURED MERCARI ITEM STRUCTURE ===');
    console.log('All fields:', Object.keys(capturedData));
    console.log('\nFull item:', capturedData);
    
    // Look for any date-related fields
    const dateFields = Object.keys(capturedData).filter(key => 
      key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('time') ||
      key.toLowerCase().includes('created') ||
      key.toLowerCase().includes('updated') ||
      key.toLowerCase().includes('listed') ||
      key.toLowerCase().includes('posted') ||
      key.toLowerCase().includes('timestamp')
    );
    
    console.log('\n📅 DATE-RELATED FIELDS FOUND:', dateFields);
    dateFields.forEach(field => {
      console.log(`  ${field}:`, capturedData[field]);
    });
    
    if (dateFields.length === 0) {
      console.warn('⚠️  NO DATE FIELDS FOUND IN API RESPONSE!');
      console.warn('This means Mercari\'s searchQuery API doesn\'t return listing dates.');
      console.warn('We may need to scrape dates from the item page HTML instead.');
    }
  }
}, 5000); // Wait 5 seconds after clicking sync

console.log('✅ Script ready! Now click "Get Latest Mercari Items" and wait 5 seconds...');
