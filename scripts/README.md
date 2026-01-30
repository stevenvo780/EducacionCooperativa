# Scripts

- scripts/firebase/extract_service_account.js
  - Extrae FIREBASE_SERVICE_ACCOUNT de un .env y lo imprime como JSON.
  - Uso: `node scripts/firebase/extract_service_account.js --env-file .env.local --out serviceAccountKey.json`
- scripts/admin/sync_user.js
  - Sincroniza un usuario en Firestore.
  - Env: `SERVICE_ACCOUNT_PATH`, `UID`, `EMAIL`, `DISPLAY_NAME` (opcional), `PASSWORD` o `PASSWORD_HASH`.
- scripts/admin/update_password.js
  - Actualiza la contrasena en Firebase Auth.
  - Env: `SERVICE_ACCOUNT_PATH`, `UID`, `PASSWORD`.
