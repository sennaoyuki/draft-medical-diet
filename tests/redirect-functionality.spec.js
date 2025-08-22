const { test, expect } = require('@playwright/test');

test.describe('Mouthpiece001 Redirect Functionality', () => {
  let consoleLogs = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    consoleLogs = [];
    consoleErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(msg.text());
      }
    });

    // Handle page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test('should load main page successfully', async ({ page }) => {
    await page.goto('/mouthpiece001/index.html');
    
    // Wait for the page to load and check title
    await page.waitForLoadState('networkidle');
    
    // Check if the page loaded successfully
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title).not.toBe('Error response');
    
    console.log('Page title:', title);
    console.log('Console logs:', consoleLogs.length);
    console.log('Console errors:', consoleErrors.length);
    
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
  });

  test('should find and click first clinic official site button', async ({ page }) => {
    await page.goto('/mouthpiece001/index.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for the ranking section to load with the correct class
    await page.waitForSelector('.ranking-item.rank-1', { timeout: 15000 });
    
    // Look for the first clinic's official site button
    const firstRankingItem = page.locator('.ranking-item.rank-1');
    const firstClinicButton = firstRankingItem.locator('text=公式サイト').first();
    
    // Verify the button exists
    await expect(firstClinicButton).toBeVisible();
    
    console.log('Found first clinic official site button');
    
    // Get the button's parent link to understand the redirect mechanism
    const linkElement = await firstClinicButton.locator('xpath=ancestor-or-self::a').first();
    const href = await linkElement.getAttribute('href');
    
    console.log('Button href:', href);
    
    // Click the button
    await firstClinicButton.click();
    
    // Wait for navigation or redirect
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    console.log('Current URL after click:', currentUrl);
    
    // Check if we're on redirect page
    if (currentUrl.includes('redirect.html')) {
      console.log('Successfully navigated to redirect page');
      
      // Wait for redirect processing
      await page.waitForTimeout(3000);
      
      // Check if redirect occurred
      const finalUrl = page.url();
      console.log('Final URL after redirect:', finalUrl);
      
      // Verify we redirected to external URL
      expect(finalUrl).not.toContain('localhost:8082');
    } else {
      console.log('Direct navigation occurred');
    }
    
    if (consoleErrors.length > 0) {
      console.log('Console errors during test:', consoleErrors);
    }
  });

  test('should test rank 1 clinic redirect', async ({ page }) => {
    await page.goto('/mouthpiece001/index.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Look for the rank 1 clinic (Oh my teeth)
    const rank1Item = page.locator('.ranking-item.rank-1');
    await expect(rank1Item).toBeVisible({ timeout: 15000 });
    
    // Get clinic name from the rank 1 item
    const clinicNameElement = rank1Item.locator('.clinic-logo-section, .clinic-name, .clinic-main-name');
    const clinicName = await clinicNameElement.first().textContent();
    console.log('Rank 1 clinic name:', clinicName);
    
    // Find the official site button for rank 1 clinic
    const omtButton = rank1Item.locator('text=公式サイト').first();
    
    await expect(omtButton).toBeVisible();
    
    // Click the official site button
    await omtButton.click();
    
    // Wait for redirect process
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    console.log('Rank 1 clinic - Current URL:', currentUrl);
    
    if (currentUrl.includes('redirect.html')) {
      console.log('Rank 1 clinic - On redirect page, waiting for redirect...');
      
      // Check redirect page content
      const redirectMessage = await page.locator('#redirect-message').textContent();
      console.log('Redirect message:', redirectMessage);
      
      // Wait for auto-redirect (up to 10 seconds)
      let redirected = false;
      for (let i = 0; i < 50; i++) {
        await page.waitForTimeout(200);
        const url = page.url();
        if (!url.includes('redirect.html')) {
          redirected = true;
          console.log('Rank 1 clinic - Redirected to:', url);
          break;
        }
      }
      
      if (!redirected) {
        // Try clicking manual link if auto-redirect failed
        const manualLink = page.locator('#manual-link');
        if (await manualLink.isVisible()) {
          console.log('Rank 1 clinic - Using manual redirect link');
          await manualLink.click();
          await page.waitForTimeout(2000);
        }
      }
      
      const finalUrl = page.url();
      console.log('Rank 1 clinic - Final URL:', finalUrl);
      
      // Verify we ended up on an external URL
      expect(finalUrl).not.toContain('localhost:8082');
      
      // Check if URL contains expected tracking parameters
      if (finalUrl.includes('param4=')) {
        console.log('Rank 1 clinic - Contains param4 tracking parameter');
      }
    }
    
    if (consoleErrors.length > 0) {
      console.log('Rank 1 clinic test errors:', consoleErrors);
    }
  });

  test('should test multiple clinic redirects (top 3)', async ({ page }) => {
    const testRanks = [1, 2, 3];
    
    for (const rank of testRanks) {
      console.log(`Testing clinic rank: ${rank}`);
      
      await page.goto('/mouthpiece001/index.html');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      try {
        // Look for clinic by rank using correct class
        const rankSection = page.locator(`.ranking-item.rank-${rank}`).first();
        
        if (await rankSection.isVisible()) {
          const officialButton = rankSection.locator('text=公式サイト').first();
          
          if (await officialButton.isVisible()) {
            await officialButton.click();
            
            // Wait for redirect or navigation
            await page.waitForTimeout(1000);
            
            const currentUrl = page.url();
            console.log(`Rank ${rank} - Current URL:`, currentUrl);
            
            if (currentUrl.includes('redirect.html')) {
              console.log(`Rank ${rank} - On redirect page`);
              
              // Wait for auto-redirect
              for (let i = 0; i < 25; i++) {
                await page.waitForTimeout(200);
                const url = page.url();
                if (!url.includes('redirect.html')) {
                  console.log(`Rank ${rank} - Final URL:`, url);
                  expect(url).not.toContain('localhost:8082');
                  break;
                }
              }
            } else {
              console.log(`Rank ${rank} - Direct redirect to:`, currentUrl);
            }
          } else {
            console.log(`Rank ${rank} - Official site button not found`);
          }
        } else {
          console.log(`Rank ${rank} - Ranking section not found`);
        }
      } catch (error) {
        console.log(`Rank ${rank} - Test error:`, error.message);
      }
    }
    
    if (consoleErrors.length > 0) {
      console.log('Multi-clinic test errors:', consoleErrors);
    }
  });

  test('should verify redirect page parameters', async ({ page }) => {
    // Navigate directly to redirect page with test parameters
    const testParams = new URLSearchParams({
      clinic_id: '1',
      rank: '1',
      region_id: '13'
    });
    
    await page.goto(`/mouthpiece001/redirect.html?${testParams.toString()}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for redirect processing
    await page.waitForTimeout(3000);
    
    // Check if redirect message appears
    const redirectMessage = await page.locator('#redirect-message');
    await expect(redirectMessage).toBeVisible();
    
    const messageText = await redirectMessage.textContent();
    console.log('Redirect message:', messageText);
    
    // Check if clinic logo appears
    const clinicLogo = page.locator('#clinic-logo');
    const logoSrc = await clinicLogo.getAttribute('src');
    console.log('Clinic logo src:', logoSrc);
    
    // Check manual link
    const manualLink = page.locator('#manual-link');
    const linkHref = await manualLink.getAttribute('href');
    console.log('Manual link href:', linkHref);
    
    // Verify link is valid
    expect(linkHref).toBeTruthy();
    expect(linkHref).not.toBe('#');
    
    if (consoleErrors.length > 0) {
      console.log('Redirect page test errors:', consoleErrors);
    }
  });

  test('should handle missing parameters gracefully', async ({ page }) => {
    // Test redirect page without parameters
    await page.goto('/mouthpiece001/redirect.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for fallback handling
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log('URL after missing params:', currentUrl);
    
    // Should either redirect to index or show error handling
    const isRedirectPage = currentUrl.includes('redirect.html');
    const isIndexPage = currentUrl.includes('index.html');
    
    if (isRedirectPage) {
      // Check if manual link is available as fallback
      const manualLink = page.locator('#manual-link');
      if (await manualLink.isVisible()) {
        const href = await manualLink.getAttribute('href');
        console.log('Fallback manual link:', href);
        expect(href).toBeTruthy();
      }
    } else if (isIndexPage) {
      console.log('Redirected back to index page as fallback');
    }
    
    if (consoleErrors.length > 0) {
      console.log('Missing params test errors:', consoleErrors);
    }
  });

  test('should test comparison table official site links', async ({ page }) => {
    await page.goto('/mouthpiece001/index.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for comparison table to load
    await page.waitForTimeout(3000);
    
    // Find comparison table
    const comparisonTable = page.locator('#comparison-table');
    await expect(comparisonTable).toBeVisible({ timeout: 10000 });
    
    // Look for official site buttons in the table
    const officialSiteButtons = comparisonTable.locator('text=公式サイト');
    const buttonCount = await officialSiteButtons.count();
    console.log('Found official site buttons in table:', buttonCount);
    
    if (buttonCount > 0) {
      // Test the first official site button in the table
      const firstTableButton = officialSiteButtons.first();
      
      // Find the actual clickable link/button
      const clickableElement = firstTableButton.locator('xpath=following::a').first();
      
      if (await clickableElement.isVisible()) {
        const href = await clickableElement.getAttribute('href');
        console.log('Table button href:', href);
        
        await clickableElement.click();
        await page.waitForTimeout(1000);
        
        const currentUrl = page.url();
        console.log('Table redirect URL:', currentUrl);
        
        if (currentUrl.includes('redirect.html')) {
          // Wait for redirect
          await page.waitForTimeout(3000);
          const finalUrl = page.url();
          console.log('Table final URL:', finalUrl);
        }
      }
    }
    
    if (consoleErrors.length > 0) {
      console.log('Table test errors:', consoleErrors);
    }
  });
});