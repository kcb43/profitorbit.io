// DEBUG SCRIPT: Check Mercari Cached Data for startTime/listingDate
// Run this in the browser console (F12) on the Profit Orbit Import page

console.log('=== MERCARI DATA DEBUG ===');

// 1. Check localStorage cache
const cachedData = localStorage.getItem('profit_orbit_mercari_listings');
if (!cachedData) {
  console.error('❌ No cached Mercari listings found in localStorage');
} else {
  console.log('✅ Found cached data');
  const parsed = JSON.parse(cachedData);
  console.log(`📦 Total items in cache: ${parsed.length}`);
  
  // Check first 3 items
  console.log('\n📋 First 3 items:');
  parsed.slice(0, 3).forEach((item, idx) => {
    console.log(`\n--- Item ${idx + 1}: ${item.title?.substring(0, 50)}...`);
    console.log('  itemId:', item.itemId);
    console.log('  price:', item.price);
    console.log('  startTime:', item.startTime);
    console.log('  listingDate:', item.listingDate);
    console.log('  created:', item.created);
    console.log('  updated:', item.updated);
    console.log('  imported:', item.imported);
  });
  
  // Count how many have startTime
  const withStartTime = parsed.filter(item => item.startTime).length;
  const withListingDate = parsed.filter(item => item.listingDate).length;
  console.log(`\n📊 Items with startTime: ${withStartTime}/${parsed.length}`);
  console.log(`📊 Items with listingDate: ${withListingDate}/${parsed.length}`);
}

// 2. Check if extension API is available
console.log('\n=== EXTENSION API CHECK ===');
if (window.ProfitOrbitExtension) {
  console.log('✅ Extension API found');
  if (window.ProfitOrbitExtension.scrapeMercariListings) {
    console.log('✅ scrapeMercariListings function exists');
  } else {
    console.error('❌ scrapeMercariListings function NOT found');
  }
} else {
  console.error('❌ Extension API NOT found');
}

// 3. Check extension file timestamp
console.log('\n=== EXTENSION VERSION CHECK ===');
console.log('To verify extension is reloaded:');
console.log('1. Go to chrome://extensions/');
console.log('2. Find "Profit Orbit" extension');
console.log('3. Check the "Inspect views" section');
console.log('4. Look for the timestamp or version');

console.log('\n=== NEXT STEPS ===');
console.log('1. If items have NO startTime/listingDate:');
console.log('   → Extension needs to be reloaded');
console.log('   → Go to chrome://extensions/ and click reload');
console.log('   → Re-sync Mercari items');
console.log('2. If items HAVE startTime/listingDate:');
console.log('   → The data is correct, issue is in UI rendering');
console.log('   → Check browser console for errors');
