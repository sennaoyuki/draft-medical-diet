const { test, expect } = require('@playwright/test');

test.describe('Store Information Display', () => {
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

  test('should display store information in clinic details section', async ({ page }) => {
    await page.goto('/mouthpiece001/index.html');
    await page.waitForLoadState('networkidle');

    // Wait for data to load and ranking to appear
    await page.waitForTimeout(5000);

    // Check if clinic details section exists
    const clinicDetailsSection = page.locator('.clinic-details-section');
    await expect(clinicDetailsSection).toBeVisible({ timeout: 10000 });

    // Check if clinic details list exists
    const clinicDetailsList = page.locator('#clinic-details-list');
    await expect(clinicDetailsList).toBeVisible();

    // Wait for store information to load (it should be inserted by JavaScript)
    await page.waitForTimeout(3000);

    // Check if store information section exists in clinic details
    const storeInfoSection = clinicDetailsList.locator('.store-info-section');
    const isStoreInfoVisible = await storeInfoSection.isVisible();

    if (isStoreInfoVisible) {
      console.log('✅ 店舗情報セクションが見つかりました');

      // Check if brand-section exists within store info
      const brandSection = storeInfoSection.locator('.brand-section');
      await expect(brandSection).toBeVisible();

      // Check if section headings exist (clinic names)
      const sectionHeadings = brandSection.locator('.section-heading');
      const headingCount = await sectionHeadings.count();
      console.log(`📋 見つかったクリニック数: ${headingCount}`);

      // Verify we have at least one clinic
      expect(headingCount).toBeGreaterThan(0);

      // Check specific clinic headings
      const headingTexts = await sectionHeadings.allTextContents();
      console.log('🏥 クリニック名:', headingTexts);

      // Check if we have expected clinics
      const expectedClinics = ['ディオクリニック', 'ウララクリニック', 'DSクリニック', 'リエートクリニック', 'エミナルクリニック'];
      let foundClinics = 0;

      for (const expectedClinic of expectedClinics) {
        if (headingTexts.some(text => text.includes(expectedClinic))) {
          foundClinics++;
          console.log(`✅ ${expectedClinic}が見つかりました`);
        }
      }

      console.log(`📊 見つかった期待クリニック数: ${foundClinics}/${expectedClinics.length}`);

      // Check if shops sections exist
      const shopsSections = brandSection.locator('.shops');
      const shopsCount = await shopsSections.count();
      console.log(`🏪 店舗セクション数: ${shopsCount}`);

      // Check if shop items exist
      const shopItems = brandSection.locator('.shop');
      const shopItemsCount = await shopItems.count();
      console.log(`📍 店舗アイテム数: ${shopItemsCount}`);

      // Verify we have store information
      expect(shopsCount).toBeGreaterThan(0);
      expect(shopItemsCount).toBeGreaterThan(0);

      // Check store information content
      if (shopItemsCount > 0) {
        const firstStoreItem = shopItems.first();
        const shopInfo = firstStoreItem.locator('.shop-info');

        // Check if store name exists
        const shopName = shopInfo.locator('.shop-name');
        const shopNameText = await shopName.textContent();
        console.log('🏷️ 最初の店舗名:', shopNameText);
        expect(shopNameText).toBeTruthy();
        expect(shopNameText.trim()).not.toBe('');

        // Check if store address exists
        const shopAddress = shopInfo.locator('.shop-address');
        const shopAddressText = await shopAddress.textContent();
        console.log('📍 最初の店舗住所:', shopAddressText);
        expect(shopAddressText).toBeTruthy();
        expect(shopAddressText.trim()).not.toBe('');
      }

    } else {
      console.log('❌ 店舗情報セクションが見つかりませんでした');
      console.log('📄 clinic-details-listの内容:');

      // Log the content of clinic-details-list for debugging
      const clinicDetailsContent = await clinicDetailsList.innerHTML();
      console.log(clinicDetailsContent.substring(0, 500) + '...');

      // Check if there are any error messages
      const errorMessages = clinicDetailsList.locator('text=この地域には店舗がありません');
      const hasErrorMessage = await errorMessages.isVisible();

      if (hasErrorMessage) {
        console.log('⚠️ 「この地域には店舗がありません」というメッセージが表示されています');
      }
    }

    // Log console messages for debugging
    if (consoleErrors.length > 0) {
      console.log('❌ コンソールエラー:', consoleErrors);
    }

    if (consoleLogs.length > 0) {
      console.log('📝 コンソールログ:', consoleLogs.filter(log =>
        log.includes('店舗') ||
        log.includes('store') ||
        log.includes('clinic') ||
        log.includes('updateStoresDisplay')
      ));
    }

    // The test should pass if store information is visible
    expect(isStoreInfoVisible).toBe(true);
  });

  test('should verify store information structure and content', async ({ page }) => {
    await page.goto('/mouthpiece001/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check clinic details section
    const clinicDetailsList = page.locator('#clinic-details-list');
    await expect(clinicDetailsList).toBeVisible();

    // Wait for store information
    await page.waitForTimeout(3000);

    const storeInfoSection = clinicDetailsList.locator('.store-info-section');

    if (await storeInfoSection.isVisible()) {
      // Verify HTML structure
      const brandSection = storeInfoSection.locator('.brand-section');
      await expect(brandSection).toBeVisible();

      // Check CSS classes are applied correctly
      await expect(brandSection.locator('.section-heading')).toBeVisible();
      await expect(brandSection.locator('.shops')).toBeVisible();

      // Verify the section is positioned correctly (should be first child)
      const firstChild = clinicDetailsList.locator(':first-child');
      const firstChildClass = await firstChild.getAttribute('class');
      expect(firstChildClass).toContain('store-info-section');

      console.log('✅ HTML構造とCSSクラスが正しく適用されています');
    } else {
      console.log('❌ 店舗情報セクションが表示されていません');
      throw new Error('Store information section is not visible');
    }
  });
});
