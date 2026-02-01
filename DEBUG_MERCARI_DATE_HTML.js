/**
 * Debug Mercari Item Page - HTML Date Patterns
 * 
 * Run this in the console WHILE ON A MERCARI ITEM PAGE
 * Example: https://www.mercari.com/us/item/m85955812918/
 * 
 * This will search for visible date text on the page
 */

(function debugMercariDateText() {
  console.log('🔍 Searching for visible date text on Mercari item page...');
  
  const bodyText = document.body.innerText;
  const bodyHTML = document.body.innerHTML;
  
  console.log('\n📅 SEARCHING FOR DATE PATTERNS:');
  console.log('='.repeat(50));
  
  // Pattern 1: "Posted X days/hours/weeks ago"
  const relativePatterns = [
    /Posted\s+(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/gi,
    /Listed\s+(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/gi,
    /(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/gi,
  ];
  
  console.log('\n1️⃣ Relative time patterns (e.g., "5 days ago"):');
  relativePatterns.forEach((pattern, i) => {
    const matches = [...bodyText.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`  Pattern ${i + 1}: Found ${matches.length} matches`);
      matches.slice(0, 5).forEach(match => {
        console.log(`    - "${match[0]}"`);
      });
    }
  });
  
  // Pattern 2: Absolute dates (MM/DD/YYYY, etc.)
  const absolutePatterns = [
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    /\d{4}-\d{2}-\d{2}/g,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
  ];
  
  console.log('\n2️⃣ Absolute date patterns (e.g., "01/15/2026"):');
  absolutePatterns.forEach((pattern, i) => {
    const matches = [...bodyText.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`  Pattern ${i + 1}: Found ${matches.length} matches`);
      matches.slice(0, 5).forEach(match => {
        console.log(`    - "${match[0]}"`);
      });
    }
  });
  
  // Pattern 3: Search for "Listed" or "Posted" near dates
  console.log('\n3️⃣ Context around "Listed" or "Posted":');
  const contextPatterns = [
    /Listed[^<\n]{0,50}/gi,
    /Posted[^<\n]{0,50}/gi,
    /Created[^<\n]{0,50}/gi,
  ];
  
  contextPatterns.forEach((pattern, i) => {
    const matches = [...bodyText.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`  Pattern ${i + 1}: Found ${matches.length} matches`);
      matches.slice(0, 5).forEach(match => {
        console.log(`    - "${match[0]}"`);
      });
    }
  });
  
  // Pattern 4: Look in HTML for data attributes
  console.log('\n4️⃣ HTML data attributes with "date", "time", "created":');
  const allElements = document.querySelectorAll('[data-date], [data-time], [data-created], [data-updated], [data-timestamp]');
  if (allElements.length > 0) {
    console.log(`  Found ${allElements.length} elements with date-related attributes:`);
    allElements.forEach((el, i) => {
      if (i < 10) {
        console.log(`    Element ${i + 1}:`, el.outerHTML.substring(0, 100));
      }
    });
  } else {
    console.log('  No data attributes found');
  }
  
  // Pattern 5: Look for JSON in script tags
  console.log('\n5️⃣ Searching other script tags for date data:');
  const scriptTags = document.querySelectorAll('script:not([src])');
  let foundDateInScript = false;
  
  scriptTags.forEach((script, i) => {
    const content = script.textContent;
    if (content.includes('created') || content.includes('updated') || content.includes('listed')) {
      // Try to extract JSON objects with date fields
      try {
        // Look for patterns like "created":1234567890 or "createdAt":"2026-01-15"
        const createdMatch = content.match(/"(?:created|createdAt|created_at)":\s*(\d+|"[^"]+")/) ;
        const updatedMatch = content.match(/"(?:updated|updatedAt|updated_at)":\s*(\d+|"[^"]+")/);
        
        if (createdMatch || updatedMatch) {
          foundDateInScript = true;
          console.log(`  Script ${i}: Found date data`);
          if (createdMatch) console.log(`    created: ${createdMatch[1]}`);
          if (updatedMatch) console.log(`    updated: ${updatedMatch[1]}`);
        }
      } catch (e) {
        // Skip errors
      }
    }
  });
  
  if (!foundDateInScript) {
    console.log('  No date data found in script tags');
  }
  
  console.log('\n✅ Debug complete!');
  console.log('💡 Check the patterns above to see what date information is available');
})();
