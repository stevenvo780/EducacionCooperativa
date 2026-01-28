# Educación Cooperativa - Visor y Editor Colaborativo de Markdown

Sistema colaborativo para visualización y edición de documentos Markdown en tiempo real, diseñado para educación cooperativa y estudio de textos clásicos.

## Características

- 📝 Editor de Markdown en tiempo real con CodeMirror
- 👥 Edición colaborativa con WebSocket
- 🔐 Sistema de autenticación y espacios de trabajo
- 📁 Gestión de archivos (MD, TXT, PDF, imágenes)
- 🎨 Soporte para LaTeX (KaTeX)
- 📱 Diseño responsive para móviles y tablets
- 🔄 Sincronización en tiempo real entre usuarios
- 🎯 Invitaciones para colaboradores

## Tecnologías

- **Backend**: Python 3.11, aiohttp (producción local/Docker), Flask (Vercel)
- **Frontend**: JavaScript vanilla, CodeMirror, Marked.js, KaTeX
- **Base de datos**: Firebase Firestore (opcional, con fallback en memoria)
- **Despliegue**: Docker, Vercel

## Instalación

### Requisitos

- Python 3.11+
- pip

### Instalación de dependencias

```bash
pip install -r requirements.txt
```

### Instalación de navegadores para tests E2E

```bash
playwright install chromium
```

## Ejecución

### Servidor local (desarrollo)

```bash
python servidor.py
```

El servidor estará disponible en `http://localhost:8888`

### Docker

```bash
docker-compose up
```

### Variables de entorno

- `PASSWORD`: Contraseña de acceso (default: "admin")
- `DOCS_DIR`: Directorio de documentos (default: "./documentos")
- `FIREBASE_SERVICE_ACCOUNT`: Credenciales de Firebase (JSON)
- `FIREBASE_STORAGE_BUCKET`: Bucket de Firebase Storage

## Testing

Este proyecto incluye pruebas unitarias y end-to-end (E2E) para garantizar la calidad del código.

### Ejecutar todas las pruebas

```bash
pytest
```

### Ejecutar solo pruebas unitarias

```bash
pytest tests/unit/ -v
```

### Ejecutar solo pruebas E2E

```bash
# Asegúrate de que el servidor esté corriendo
python servidor.py &

# En otra terminal
pytest tests/e2e/ -v

# Detener el servidor cuando termines
```

### Ejecutar pruebas con cobertura

```bash
pytest --cov=. --cov-report=html --cov-report=term-missing
```

El reporte HTML estará disponible en `htmlcov/index.html`

### Estructura de tests

```
tests/
├── unit/               # Pruebas unitarias
│   ├── test_servidor.py   # Tests del servidor aiohttp
│   └── test_api.py        # Tests del API Flask
└── e2e/                # Pruebas end-to-end
    └── test_app.py        # Tests de flujo completo de usuario
```

### Tipos de pruebas

#### Pruebas Unitarias
- Autenticación y manejo de sesiones
- Operaciones de archivos (lectura, escritura, listado)
- Gestión de invitaciones
- Sanitización de nombres de workspace
- Endpoints de la API

#### Pruebas E2E
- Flujo de login
- Carga de la lista de archivos
- Funcionalidad de sidebar
- Conexión WebSocket
- Edición colaborativa
- Responsive design (móvil, tablet)

## Integración Continua (CI/CD)

El proyecto utiliza GitHub Actions para ejecutar automáticamente:

1. **Pruebas Unitarias**: Se ejecutan en cada push y pull request
2. **Pruebas E2E**: Validan el flujo completo de la aplicación
3. **Linting**: Verifica calidad del código con flake8, black e isort
4. **Cobertura de código**: Se genera reporte y se sube a Codecov

El workflow se encuentra en `.github/workflows/test.yml`

### Estado de los tests

Los tests se ejecutan en:
- Push a ramas: `main`, `develop`, `copilot/*`
- Pull requests a: `main`, `develop`

## Desarrollo

### Agregar nuevas pruebas

1. **Pruebas unitarias**: Agregar en `tests/unit/`
   - Usar `pytest` y `pytest-asyncio` para tests asíncronos
   - Mockear dependencias externas (Firebase, etc.)

2. **Pruebas E2E**: Agregar en `tests/e2e/`
   - Usar Playwright para automatización del navegador
   - Marcar tests asíncronos con `@pytest.mark.asyncio`

### Buenas prácticas

- Escribir tests antes de agregar nuevas funcionalidades (TDD)
- Mantener la cobertura de código por encima del 70%
- Ejecutar tests localmente antes de hacer push
- Documentar casos especiales en los tests

## Despliegue

### Verificación antes del despliegue

Antes de desplegar, asegúrate de que:

```bash
# Todas las pruebas pasen
pytest

# El código esté formateado correctamente
black . --check

# No haya errores de importación
isort --check-only .

# No haya errores de sintaxis críticos
flake8 . --select=E9,F63,F7,F82
```

### Docker

El proyecto incluye un `Dockerfile` y `docker-compose.yml` para despliegue en contenedores.

```bash
docker-compose up -d
```

### Vercel

El proyecto está configurado para despliegue en Vercel usando el API Flask en `api/index.py`.

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Asegúrate de que todos los tests pasen
4. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
5. Push a la rama (`git push origin feature/AmazingFeature`)
6. Abre un Pull Request

## Licencia

Este proyecto es de código abierto y está disponible bajo la licencia que elija el propietario del repositorio.

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, por favor abre un issue en GitHub.
