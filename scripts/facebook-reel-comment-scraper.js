/**
 * Facebook Reel Comment Scraper - Browser Console Script
 * 
 * This script searches for a specific username/name within comments of a Facebook reel post.
 * 
 * Instructions:
 * 1. Navigate to a Facebook reel post
 * 2. Scroll down to load comments (or expand comments section)
 * 3. Open browser console (F12)
 * 4. Paste this entire script and press Enter
 * 5. The script will search for the specified name in all visible comments
 * 6. Results will be displayed in the console
 * 
 * Usage:
 * - By default, searches for "Danielle Marie"
 * - To search for a different name, modify the SEARCH_NAME variable below
 */

(function searchFacebookReelComments() {
  console.log('🔍 Facebook Reel Comment Scraper Started...');
  console.log('📄 Searching for names in comments...\n');

  // ===== CONFIGURATION =====
  const SEARCH_NAME = "Danielle Marie"; // Change this to search for a different name
  const CASE_SENSITIVE = false; // Set to true for case-sensitive search
  // ==========================

  const foundComments = [];
  const allCommentLinks = [];

  // Function to normalize text for comparison
  const normalizeText = (text) => {
    return CASE_SENSITIVE ? text.trim() : text.trim().toLowerCase();
  };

  const searchName = normalizeText(SEARCH_NAME);

  // Function to extract name from anchor tag
  const extractNameFromLink = (linkElement) => {
    try {
      // Look for the span with the name inside the anchor tag
      const nameSpan = linkElement.querySelector('span[dir="auto"]');
      if (nameSpan) {
        return nameSpan.textContent?.trim() || '';
      }
      
      // Fallback: get text directly from the link
      return linkElement.textContent?.trim() || '';
    } catch (error) {
      return '';
    }
  };

  // Function to find comment container from a link
  const findCommentContainer = (linkElement) => {
    let element = linkElement;
    // Traverse up the DOM to find the comment container
    // Facebook comments are usually in a div with specific classes
    for (let i = 0; i < 10; i++) {
      if (!element || !element.parentElement) break;
      
      // Check if this element looks like a comment container
      const classes = element.className || '';
      if (typeof classes === 'string' && (
        classes.includes('comment') || 
        classes.includes('x1y1aw1k') || // Common Facebook comment class
        element.getAttribute('role') === 'article'
      )) {
        return element;
      }
      
      element = element.parentElement;
    }
    return null;
  };

  // Function to get comment text
  const getCommentText = (commentContainer) => {
    if (!commentContainer) return '';
    
    // Try to find the comment text element
    // Facebook comment text is usually in a span or div with specific attributes
    const textSelectors = [
      'span[dir="auto"]',
      'div[dir="auto"]',
      '[data-testid="comment"]',
      '.x193iq5w', // Common Facebook text class
    ];
    
    for (const selector of textSelectors) {
      const elements = commentContainer.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        // Skip if it's just the username or very short
        if (text.length > 20 && !text.includes('http')) {
          return text;
        }
      }
    }
    
    return '';
  };

  // Main search function
  const searchComments = () => {
    console.log(`🔍 Searching for: "${SEARCH_NAME}" (Case sensitive: ${CASE_SENSITIVE})\n`);

    // Find all anchor tags that match the pattern for user names in comments
    // These are links with href containing "facebook.com" and "comment_id"
    const allLinks = document.querySelectorAll('a[href*="facebook.com"][href*="comment"]');
    
    console.log(`📊 Found ${allLinks.length} potential comment links`);

    // Also search for links with the specific class pattern from your example
    const nameLinks = document.querySelectorAll('a.x1i10hfl.xjbqb8w[href*="facebook.com"]');
    
    console.log(`📊 Found ${nameLinks.length} name links with matching classes\n`);

    // Combine both sets
    const allNameLinks = new Set([...allLinks, ...nameLinks]);

    console.log(`📊 Total unique links to check: ${allNameLinks.size}\n`);

    // Search through all links
    allNameLinks.forEach((link, index) => {
      const name = extractNameFromLink(link);
      
      if (name) {
        allCommentLinks.push({
          link,
          name,
          href: link.getAttribute('href') || '',
        });

        // Check if this name matches our search
        if (normalizeText(name) === searchName || 
            normalizeText(name).includes(searchName) ||
            searchName.includes(normalizeText(name))) {
          
          const commentContainer = findCommentContainer(link);
          const commentText = getCommentText(commentContainer);
          
          foundComments.push({
            name,
            commentText,
            link: link.getAttribute('href') || '',
            element: commentContainer || link,
          });

          // Highlight the found comment
          if (commentContainer) {
            commentContainer.style.outline = '3px solid #10b981';
            commentContainer.style.outlineOffset = '2px';
            commentContainer.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
          } else {
            link.style.outline = '3px solid #10b981';
            link.style.outlineOffset = '2px';
          }
        }
      }
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('SEARCH RESULTS');
    console.log('='.repeat(80) + '\n');

    if (foundComments.length > 0) {
      console.log(`✅ Found ${foundComments.length} comment(s) by "${SEARCH_NAME}":\n`);
      
      foundComments.forEach((comment, index) => {
        console.log(`\n${index + 1}. Comment by: ${comment.name}`);
        console.log(`   Link: ${comment.link}`);
        if (comment.commentText) {
          console.log(`   Comment: ${comment.commentText.substring(0, 200)}${comment.commentText.length > 200 ? '...' : ''}`);
        }
        console.log('   ──────────────────────────────────────────────────────────────');
      });

      console.log(`\n✅ Total: ${foundComments.length} match(es) found and highlighted on the page.`);
    } else {
      console.log(`❌ No comments found by "${SEARCH_NAME}"`);
      console.log(`\n💡 Tips:`);
      console.log(`   - Make sure you've scrolled down to load all comments`);
      console.log(`   - Try expanding the comments section if it's collapsed`);
      console.log(`   - Check if the name spelling is correct (currently searching for: "${SEARCH_NAME}")`);
      console.log(`   - Found ${allCommentLinks.length} total comment authors on this page`);
    }

    // Show all unique names found (for debugging)
    if (allCommentLinks.length > 0) {
      const uniqueNames = [...new Set(allCommentLinks.map(c => c.name))].sort();
      console.log(`\n📋 All comment authors found (${uniqueNames.length} unique):`);
      console.log(`   ${uniqueNames.slice(0, 20).join(', ')}${uniqueNames.length > 20 ? '...' : ''}`);
    }

    console.log('\n' + '='.repeat(80));
    return foundComments;
  };

  // Scroll to load more comments, then search
  const scrollAndSearch = async () => {
    console.log('📜 Scrolling to load comments...');
    
    // Scroll down a bit to trigger lazy loading
    const initialScroll = window.scrollY;
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll back up
    window.scrollTo(0, initialScroll);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now search
    const results = searchComments();
    
    return results;
  };

  // Run the search
  scrollAndSearch();
})();

