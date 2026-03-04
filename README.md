# EducacionCooperativa

Plataforma colaborativa con arquitectura distribuida: aplicacion web, hub de realtime y worker de ejecucion remota.

## Arquitectura

- `web` (Next.js 14): interfaz principal.
- `services/hub` (Node + Socket.IO): coordinador de sesiones/eventos.
- `services/worker` (Node sobre Ubuntu): agente de ejecucion y workspace.

## Infraestructura local

`docker-compose.yml` levanta:
- `hub`: `3010:3010`
- `web`: `3011:3000`
- `worker`: `network_mode: host` y volumenes persistentes por `WORKER_TOKEN`

Requisitos de entorno:
- `.env.local` con variables de Firebase y tokens de worker.
- `serviceAccountKey.json` para integracion de almacenamiento/servicios.

## Arranque rapido

```bash
cd EducacionCooperativa
docker compose up --build
```

Modo local sin Docker:

```bash
npm install
npm run dev
npm --prefix services/hub install && npm --prefix services/hub run dev
```

## Despliegue

- Scripts de produccion en `desplieges-prod/`.
- Guia operativa en `desplieges-prod/README.md`.
