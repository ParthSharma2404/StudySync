import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting E2E test sequence for StudySync...');
  let browser;
  try {
    // Launch browser with fake permissions for camera/mic
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--auto-select-desktop-capture-source=Entire screen' // Needed for screen share mock
      ]
    });
    
    const page = await browser.newPage();
    console.log('Browser launched.');

    // Step 1: Login
    console.log('Navigating to Login...');
    await page.goto('http://localhost:5173/login');
    
    // Fill in login credentials (assume test user exists or register one)
    console.log('Filling out registration...');
    await page.goto('http://localhost:5173/register');
    
    const randomUser = `testuser_${Date.now()}`;
    const randomEmail = `${randomUser}@test.com`;
    await page.type('input[placeholder="study_champ"]', randomUser);
    await page.type('input[placeholder="you@example.com"]', randomEmail);
    await page.type('input[placeholder="Min 6 characters"]', 'password123');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for redirect to login...');
    await page.waitForSelector('text/Welcome Back', { timeout: 10000 });

    console.log('Logging in...');
    await page.type('input[placeholder="you@example.com"]', randomEmail);
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for navigation to dashboard...');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const clickButtonByText = async (text) => {
      await page.evaluate((btnText) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes(btnText));
        if (btn) btn.click();
        else throw new Error('Button not found: ' + btnText);
      }, text);
    };

    // Step 2: Create a Room
    console.log('On Dashboard. Creating a new Squad Room...');
    // Wait for the room creation input to be visible
    await page.waitForSelector('input[placeholder="e.g. Calculus Cram Session"]');
    await page.type('input[placeholder="e.g. Calculus Cram Session"]', 'E2E Test Room');
    await clickButtonByText('Create & Launch Room');
    
    // Wait to be redirected to the room lobby
    console.log('Waiting for Lobby...');
    await page.waitForSelector('::-p-text(Enable Webcam)', { timeout: 10000 });
    console.log('Lobby reached!');

    // Step 3: Authorize permissions
    console.log('Clicking Enable Webcam...');
    await clickButtonByText('Enable Webcam');
    
    // Wait for checkmark
    await page.waitForSelector('text/Webcam Active & Rendered');
    console.log('Webcam authorized!');

    console.log('Clicking Enable Tab Share...');
    await clickButtonByText('Enable Tab Share');
    
    // Wait for checkmark
    await page.waitForSelector('text/Tab Share Confirmed');
    console.log('Tab Share authorized!');

    // Step 4: Enter Workspace
    console.log('Clicking Enter Study Workspace...');
    await clickButtonByText('Enter Study Workspace');
    
    // Step 5: Verify Workspace UI
    console.log('Verifying Workspace UI...');
    await page.waitForSelector('text/Planning Phase');
    
    console.log('Checking for Moderator...');
    await page.waitForFunction((username) => {
      const el = document.querySelector('body');
      return el && el.innerText.includes(`Moderator: ${username}`);
    }, {}, randomUser);
    console.log(`Moderator correctly assigned as ${randomUser}.`);

    // Step 6: Start Timer
    console.log('Starting Study Session Timer...');
    await clickButtonByText('Start Study Session');
    
    // Wait for "Room Uptime" text to appear
    await page.waitForSelector('text/Room Uptime');
    console.log('Timer started successfully!');

    // Step 7: Create a task
    console.log('Creating a group task...');
    await page.type('input[placeholder="Add a new objective..."]', 'Complete E2E test');
    await clickButtonByText('Add Task');
    
    // Wait for task to appear in list
    await page.waitForSelector('text/Complete E2E test');
    console.log('Task successfully added to the quest list!');

    console.log('------------------------------------');
    console.log('✅ ALL E2E TESTS PASSED SUCCESSFULLY! ✅');
    console.log('------------------------------------');
    
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
})();
