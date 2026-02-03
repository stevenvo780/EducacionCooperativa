import { test, expect } from '@playwright/test';

test('Search functionality', async ({ page }) => {
  // 1. Bypass Auth
  await page.goto('http://localhost:3015/');
  await page.evaluate(() => {
    localStorage.setItem('agora_user', JSON.stringify({
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User'
    }));
    localStorage.setItem('agora_user_email', 'test@example.com');
  });

  // 2. Navigate to Dashboard
  await page.goto('http://localhost:3015/dashboard');
  
  // Wait for dashboard to load
  await expect(page.locator('button[title="Nueva Sesión"]')).toBeVisible({ timeout: 20000 });

  // 3. Create a new Markdown file (or use existing if simpler, but creating is safer)
  // We need to find the "New File" button or use the explorer.
  // Looking at MosaicLayout/Sidebar, usually there's a + button for files.
  // Let's assume there's a way to create a file.
  // Alternatively, we can inject a document into the state if possible, but UI interaction is better.
  
  // Let's try to locate the "New Text File" button.
  // In `Sidebar.tsx` (inferred), usually a button.
  // Or we can try to find an existing file editor. 
  // If "MI ASISTENTE" is visible, maybe there's a file explorer.
  
  // Let's try to click "Create File" button if it exists.
  // Based on `MosaicLayout.tsx`, `onCreateFile` is passed.
  // In `WorkspaceExplorer`, there might be a button.
  
  // Let's verify we have a "personal" workspace.
  // Assuming the empty state or default state.
  
  // If we can't easily create a file via UI, we might be stuck.
  // But `MosaicEditor` is used for "text" documents.
  // Let's check if we can simulate opening a document.
  
  // Let's look for a button with `FilePlus` icon or title "Nuevo Archivo".
  const newFileBtn = page.locator('button[title="Nuevo Documento"]');
  if (await newFileBtn.isVisible()) {
      await newFileBtn.click();
  } else {
      // Maybe in a menu?
      // Look for a generic plus button in the sidebar header?
      // For now, let's just log what we see if we fail.
      console.log('Searching for New Document button...');
  }

  // If we manage to open an editor:
  // We need to type into it.
  // The editor uses CodeMirror.
  // We can locate `.cm-content`.
  
  // Let's wait for editor to be visible.
  // Use `page.getByRole('textbox')` or `.cm-content`.
  
  // Wait for the "Editor" window title or similar.
  // Is there a default open tab?
  // `DashboardPage` might have a welcome doc.
  
  // If we can't ensure a doc is open, the test will be hard.
  // Let's try to open a file from the explorer if any exist.
  // Or if the dashboard starts empty.
  
  // Let's assume we can get an editor open.
  // Check if `.cm-content` exists.
  const editor = page.locator('.cm-content');
  // If not visible, we fail.
  
  // Type some text
  const textToType = "Este es un texto de prueba para la busqueda. Busqueda debe resaltar.";
  await editor.fill(textToType);
  
  // 4. Test Search
  // Currently the search input is in the window toolbar for the editor.
  // Input with placeholder "Buscar..." inside the Mosaic window toolbar.
  const searchInput = page.locator('input[placeholder="Buscar..."]');
  await expect(searchInput).toBeVisible();
  
  await searchInput.fill('Busqueda');
  
  // 5. Verify Highlight
  // Wait for <mark> with class search-highlight
  await expect(page.locator('mark.search-highlight')).toHaveCount(2, { timeout: 5000 });
  
  // 6. Verify Navigation
  // Buttons with title "Anterior (↑)" and "Siguiente (↓)"
  const nextBtn = page.locator('button[title="Siguiente (↓)"]');
  const prevBtn = page.locator('button[title="Anterior (↑)"]');
  const counter = page.getByText('1/2');
  
  await expect(nextBtn).toBeVisible();
  await expect(counter).toBeVisible();
  
  // Click next
  await nextBtn.click();
  await expect(page.getByText('2/2')).toBeVisible();
  
  // Click prev
  await prevBtn.click();
  await expect(page.getByText('1/2')).toBeVisible();
  
});
