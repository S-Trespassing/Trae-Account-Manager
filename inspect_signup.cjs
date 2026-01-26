
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // User asked to open window, but headless might be safer for automation. 
  // However, since I need to inspect, I'll use headless=true to just get the html, or false if I can see it. 
  // Given the environment, I probably can't see it, but the code will run.
  // The user asked to "control browser to open incognito window".
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('Navigating to sign-up page...');
  await page.goto('https://www.trae.ai/sign-up');
  
  console.log('Waiting for page load...');
  await page.waitForTimeout(5000); // Wait for hydration
  
  // Dump all buttons
  const buttons = await page.$$eval('button', (els) => {
    return els.map(el => ({
      text: el.innerText,
      html: el.outerHTML,
      classes: el.className
    }));
  });
  
  console.log('Found buttons:', JSON.stringify(buttons, null, 2));
  
  // Also check for inputs to confirm structure
  const inputs = await page.$$eval('input', (els) => {
    return els.map(el => ({
      name: el.name,
      placeholder: el.placeholder,
      type: el.type
    }));
  });
  
  console.log('Found inputs:', JSON.stringify(inputs, null, 2));

  await browser.close();
})();
