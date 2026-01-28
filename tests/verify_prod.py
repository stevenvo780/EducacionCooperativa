import asyncio
import random
import string
from playwright.async_api import async_playwright

BASE_URL = "https://visormarkdown.vercel.app"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Capturar logs de consola
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        
        # Generar usuario aleatorio
        rand_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        email = f"testuser_{rand_suffix}@example.com"
        password = "Password123!"
        name = f"Test User {rand_suffix}"

        print(f"Testing with user: {email}")

        # 1. Prueba de REGISTRO
        print(f"Navigating to {BASE_URL}/register.html")
        await page.goto(f"{BASE_URL}/register.html")
        
        await page.fill("#name", name)
        await page.fill("#email", email)
        await page.fill("#password", password)
        await page.fill("#confirm-password", password)
        
        print("Submitting registration form...")
        async with page.expect_response(lambda response: "register" in response.url or "google" in response.url or "login" in response.url) as response_info:
             await page.click("#register-btn")
        
        # Esperar un poco para ver si hay redirección o error
        try:
            await page.wait_for_url(f"{BASE_URL}/index.html", timeout=10000)
            print("✅ Registration successful: Redirected to index.html")
            
            # Esperar a que cargue la lista de archivos para confirmar que la API funciona
            try:
                # Esperar a que aparezca al menos un archivo o una carpeta en el file-tree
                # Asumiendo que hay una clase .file-item o .folder-item o el contenedor #file-tree se llena
                print("Waiting for file list to load...")
                # Esperamos a que no esté vacío el file-tree o que no haya error
                await page.wait_for_selector("#file-tree", state="visible")
                # Damos un momento para que el fetch termine
                await page.wait_for_timeout(3000) 
                
                # Verificar si hay error visible en consola (ya capturado) o UI
                error_elem = await page.query_selector(".toast.error")
                if error_elem:
                   err_text = await error_elem.inner_text()
                   print(f"⚠️ Found error toast on index: {err_text}")

            except Exception as e:
                print(f"⚠️ Warning during file list wait: {e}")

        except:
            print(f"❌ Registration failed or didn't redirect. Current URL: {page.url}")
            # Ver si hay toast de error
            toast = await page.query_selector(".toast.error")
            if toast:
                msg = await toast.inner_text()
                print(f"❌ Error Toast: {msg}")
            
            # Si falló el registro, no podemos probar login con este usuario
            await browser.close()
            return

        # 2. Prueba LOGOUT (para probar login limpio)
        # Asumiendo que hay un botón de logout o simplemente limpiando storage
        print("Clearing storage to simulate logout...")
        await page.evaluate("localStorage.clear()")
        await page.goto(f"{BASE_URL}/login.html")

        # 3. Prueba de LOGIN
        print(f"Navigating to {BASE_URL}/login.html")
        await page.fill("#email", email)
        await page.fill("#password", password)
        
        print("Submitting login form...")
        await page.click("#login-btn")
        
        try:
            await page.wait_for_url(f"{BASE_URL}/index.html", timeout=10000)
            print("✅ Login successful: Redirected to index.html")
        except:
            print(f"❌ Login failed or didn't redirect. Current URL: {page.url}")
            toast = await page.query_selector(".toast.error")
            if toast:
                msg = await toast.inner_text()
                print(f"❌ Error Toast: {msg}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
