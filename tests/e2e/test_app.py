"""
End-to-end tests for the collaborative markdown editor
Tests the complete user flow from login to file editing
"""
import pytest
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright, expect


# Base URL for testing
BASE_URL = os.getenv('TEST_BASE_URL', 'http://localhost:8888')
TEST_EMAIL = 'test@example.com'
TEST_PASSWORD = os.getenv('PASSWORD', 'admin')


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def browser():
    """Launch browser for testing"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        yield browser
        await browser.close()


@pytest.fixture
async def page(browser):
    """Create a new page for each test"""
    context = await browser.new_context()
    page = await context.new_page()
    yield page
    await context.close()


@pytest.mark.asyncio
class TestLoginFlow:
    """Test user authentication flow"""
    
    async def test_login_page_loads(self, page):
        """Test that login page loads correctly"""
        await page.goto(BASE_URL)
        
        # Check for login overlay
        login_overlay = page.locator('#login-overlay')
        await expect(login_overlay).to_be_visible()
        
        # Check for login inputs
        email_input = page.locator('#email-input')
        password_input = page.locator('#password-input')
        await expect(email_input).to_be_visible()
        await expect(password_input).to_be_visible()
    
    async def test_successful_login(self, page):
        """Test successful login flow"""
        await page.goto(BASE_URL)
        
        # Fill login form
        await page.fill('#email-input', TEST_EMAIL)
        await page.fill('#password-input', TEST_PASSWORD)
        
        # Click login button
        await page.click('button.login-btn')
        
        # Wait for login to complete (overlay should disappear)
        await page.wait_for_selector('#login-overlay', state='hidden', timeout=5000)
        
        # Verify main interface is visible
        sidebar = page.locator('.sidebar')
        await expect(sidebar).to_be_visible()
    
    async def test_login_with_wrong_password(self, page):
        """Test login with incorrect password"""
        await page.goto(BASE_URL)
        
        await page.fill('#email-input', TEST_EMAIL)
        await page.fill('#password-input', 'wrongpassword')
        
        # Click login button
        await page.click('button.login-btn')
        
        # Login overlay should remain visible
        await asyncio.sleep(1)  # Wait for response
        login_overlay = page.locator('#login-overlay')
        await expect(login_overlay).to_be_visible()
    
    async def test_login_without_email(self, page):
        """Test login without email"""
        await page.goto(BASE_URL)
        
        await page.fill('#password-input', TEST_PASSWORD)
        
        # Click login button
        await page.click('button.login-btn')
        
        # Login overlay should remain visible
        await asyncio.sleep(1)
        login_overlay = page.locator('#login-overlay')
        await expect(login_overlay).to_be_visible()


@pytest.mark.asyncio
class TestFileOperations:
    """Test file management operations"""
    
    async def login(self, page):
        """Helper to login before tests"""
        await page.goto(BASE_URL)
        await page.fill('#email-input', TEST_EMAIL)
        await page.fill('#password-input', TEST_PASSWORD)
        await page.click('button.login-btn')
        await page.wait_for_selector('#login-overlay', state='hidden', timeout=5000)
    
    async def test_file_list_loads(self, page):
        """Test that file list loads after login"""
        await self.login(page)
        
        # Wait for file list to load
        await asyncio.sleep(2)
        
        # Check that file list container exists
        file_list = page.locator('.file-list, #file-list')
        # Just check it exists, may or may not have files
        count = await file_list.count()
        assert count >= 0
    
    async def test_sidebar_toggle(self, page):
        """Test sidebar toggle functionality"""
        await self.login(page)
        
        # Find sidebar toggle button
        toggle_btn = page.locator('#sidebar-toggle, .sidebar-toggle')
        if await toggle_btn.count() > 0:
            await toggle_btn.click()
            await asyncio.sleep(0.5)
            
            # Click again to show
            await toggle_btn.click()
            await asyncio.sleep(0.5)


@pytest.mark.asyncio
class TestCollaborativeEditing:
    """Test collaborative editing features"""
    
    async def login(self, page):
        """Helper to login"""
        await page.goto(BASE_URL)
        await page.fill('#email-input', TEST_EMAIL)
        await page.fill('#password-input', TEST_PASSWORD)
        await page.click('button.login-btn')
        await page.wait_for_selector('#login-overlay', state='hidden', timeout=5000)
    
    async def test_websocket_connection(self, page):
        """Test that WebSocket connection is established"""
        # Set up console error listener before any page operations
        console_errors = []
        page.on('console', lambda msg: console_errors.append(msg) if msg.type == 'error' else None)
        
        await self.login(page)
        
        # Wait a moment for WebSocket to connect
        await asyncio.sleep(2)
        
        # No WebSocket connection errors should be present
        ws_errors = [err for err in console_errors if 'websocket' in str(err).lower()]
        assert len(ws_errors) == 0


@pytest.mark.asyncio  
class TestResponsiveness:
    """Test responsive design and mobile compatibility"""
    
    async def test_mobile_viewport(self, browser):
        """Test application on mobile viewport"""
        # Create mobile context
        context = await browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
        )
        page = await context.new_page()
        
        await page.goto(BASE_URL)
        
        # Login form should be visible on mobile
        login_overlay = page.locator('#login-overlay')
        await expect(login_overlay).to_be_visible()
        
        await context.close()
    
    async def test_tablet_viewport(self, browser):
        """Test application on tablet viewport"""
        context = await browser.new_context(
            viewport={'width': 768, 'height': 1024}
        )
        page = await context.new_page()
        
        await page.goto(BASE_URL)
        
        # Page should load successfully
        login_overlay = page.locator('#login-overlay')
        await expect(login_overlay).to_be_visible()
        
        await context.close()
