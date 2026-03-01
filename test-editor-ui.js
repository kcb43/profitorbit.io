import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  let browser;
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(10000);

    console.log('📱 Navigating to http://localhost:5175...');
    await page.goto('http://localhost:5175/', { waitUntil: 'networkidle2' });

    // Wait a moment for the app to hydrate
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // Try to trigger the image editor by looking for an upload/edit button
    console.log('🔍 Looking for image editor trigger...');
    try {
      // Check if there's an inventory page or direct editor open
      const editorOpen = await page.evaluate(() => {
        return document.querySelector('[role="dialog"]') || 
               document.querySelector('.FIE_root') ||
               document.querySelector('[data-test-id="image-editor"]') ? true : false;
      });
      console.log(`  Editor visible on page load: ${editorOpen}`);
    } catch (e) {
      console.log('  Could not detect editor on load');
    }

    // Check for toolbar centering
    console.log('\n📊 Checking UI centering...');
    const toolbarInfo = await page.evaluate(() => {
      const toolbar = document.querySelector('.FIE_topbar') || 
                      document.querySelector('[class*="topbar"]') ||
                      document.querySelector('div[style*="rgb"]');
      
      if (!toolbar) {
        return { found: false, message: 'Toolbar not found' };
      }

      const centerGroup = toolbar.querySelector('.FIE_topbar-center-options') ||
                          toolbar.querySelector('[class*="center-options"]');
      
      const rect = toolbar.getBoundingClientRect();
      const centerX = window.innerWidth / 2;
      const toolbarMid = (rect.left + rect.right) / 2;

      return {
        found: true,
        message: 'Toolbar found',
        toolbarWidth: rect.width,
        toolbarX: rect.left,
        centerGroupFound: !!centerGroup,
        windowCenterX: centerX,
        toolbarMidX: toolbarMid,
        isCentered: Math.abs(centerX - toolbarMid) < 10,
      };
    });
    console.log('  Toolbar info:', JSON.stringify(toolbarInfo, null, 2));

    // Check for zoom slider and pixel size display
    console.log('\n🔎 Checking crop view elements...');
    const cropViewInfo = await page.evaluate(() => {
      const zoomContainer = document.querySelector('input[type="range"]')?.parentElement;
      if (!zoomContainer) return { found: false, message: 'Zoom slider container not found' };

      const pixelSizeText = Array.from(document.querySelectorAll('.text-xs'))
        .find(el => el.textContent.includes('×') && el.textContent.includes('px'));

      const zoomLabel = Array.from(document.querySelectorAll('.text-xs'))
        .find(el => el.textContent.includes('Zoom'));

      return {
        found: true,
        zoomSliderFound: !!document.querySelector('input[type="range"]'),
        pixelSizeFound: !!pixelSizeText,
        pixelSizeText: pixelSizeText?.textContent || 'N/A',
        zoomLabelFound: !!zoomLabel,
        zoomPercentage: zoomLabel?.nextElementSibling?.textContent || 'N/A',
      };
    });
    console.log('  Crop view info:', JSON.stringify(cropViewInfo, null, 2));

    // Check filmstrip centering
    console.log('\n🎬 Checking filmstrip...');
    const filmstripInfo = await page.evaluate(() => {
      const filmstrip = document.querySelector('div[style*="flex"]')?.parentElement;
      // Look for the filmstrip by its structure: prev/next buttons + thumbnails
      const prevBtn = Array.from(document.querySelectorAll('button'))
        .find(btn => btn.querySelector('svg') && btn.textContent.trim() === '');

      if (!prevBtn) return { found: false, message: 'Filmstrip not found' };

      const container = prevBtn.closest('div[style*="flex"]');
      const rect = container?.getBoundingClientRect();

      return {
        found: true,
        message: 'Filmstrip structure detected',
        isFlexCentered: container?.style.justifyContent === 'center',
      };
    });
    console.log('  Filmstrip info:', JSON.stringify(filmstripInfo, null, 2));

    // Take a screenshot for visual inspection
    console.log('\n📸 Taking screenshot...');
    const screenshotPath = path.join(__dirname, 'editor-ui-check.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  Screenshot saved to: ${screenshotPath}`);

    console.log('\n✅ UI verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
