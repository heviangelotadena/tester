import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {

  test('should load the homepage and show the contact form', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Tester/i);

    // Scroll to contact form
    const form = page.locator('#contactForm');
    await form.scrollIntoViewIfNeeded();
    await expect(form).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    await page.goto('/');

    const form = page.locator('#contactForm');
    await form.scrollIntoViewIfNeeded();

    // Click submit without filling anything
    await page.click('#submitBtn');

    // Browser native validation should prevent submission
    // Check that we're still on the same page
    await expect(page).toHaveURL('/');
  });

  test('should submit form and redirect to thank-you page', async ({ page }) => {
    await page.goto('/');

    // Scroll to the contact section
    const form = page.locator('#contactForm');
    await form.scrollIntoViewIfNeeded();

    // Fill in the form
    await page.fill('#formName', 'Playwright Test User');
    await page.fill('#formEmail', 'playwright-test@example.com');
    await page.fill('#formMessage', 'This is an automated test from Playwright. Testing the full form submission flow.');

    // Check newsletter box
    await page.check('#formNewsletter');

    // Intercept the API call to avoid sending real emails / hitting Supabase
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Thank you for your submission! We will get back to you soon.'
        }),
      });
    });

    // Submit the form
    await page.click('#submitBtn');

    // Wait for the success message to appear
    await expect(page.locator('#formSuccess')).toBeVisible({ timeout: 5000 });

    // Wait for redirect to thank-you page (the form redirects after 2s)
    await page.waitForURL('**/thank-you.html', { timeout: 10000 });
    await expect(page).toHaveURL(/thank-you/);

    // Verify the thank-you page content
    await expect(page.locator('h1')).toContainText('Thank You');
  });

  test('should submit form to real API and verify Supabase storage', async ({ page }) => {
    await page.goto('/');

    const form = page.locator('#contactForm');
    await form.scrollIntoViewIfNeeded();

    const testEmail = `e2e-test-${Date.now()}@example.com`;

    await page.fill('#formName', 'E2E Real Test');
    await page.fill('#formEmail', testEmail);
    await page.fill('#formMessage', 'Real API integration test from Playwright');
    await page.check('#formNewsletter');

    // Listen for the API response (no mocking — hits real server)
    const responsePromise = page.waitForResponse('**/api/contact');
    await page.click('#submitBtn');

    const response = await responsePromise;
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body.success).toBe(true);

    // Verify data landed in Supabase via the submissions API
    const submissionsResponse = await page.request.get('/api/submissions');
    const submissions = await submissionsResponse.json();

    const found = submissions.find(s => s.email === testEmail);
    expect(found).toBeTruthy();
    expect(found.name).toBe('E2E Real Test');
    expect(found.newsletter_subscription).toBe(true);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto('/');

    const form = page.locator('#contactForm');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#formName', 'Error Test');
    await page.fill('#formEmail', 'error@test.com');
    await page.fill('#formMessage', 'Testing error handling');

    // Mock a server error
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Server error for testing'
        }),
      });
    });

    await page.click('#submitBtn');

    // Should show error message
    await expect(page.locator('#formError')).toBeVisible({ timeout: 5000 });
  });

});

test.describe('Thank You Page', () => {

  test('should load and show confirmation content', async ({ page }) => {
    await page.goto('/thank-you.html');

    await expect(page.locator('h1')).toContainText('Thank You');
    await expect(page.locator('text=24 hours')).toBeVisible();
    await expect(page.locator('a[href="index.html"]').first()).toBeVisible();
  });

});

test.describe('API Health', () => {

  test('should return healthy status', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.services.supabase).toBe(true);
    expect(body.services.resend).toBe(true);
  });

});
