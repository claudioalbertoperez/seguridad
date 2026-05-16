# Fiscaliza Web

Proyecto base de plataforma web para fiscalizacion municipal en Chile.

## Stack

- Frontend: React + Vite
- Backend: Express

## Scripts

- `npm install`
- `npm run server`
- `npm run dev`
- `npm run build`

## Variables de entorno

Usa `.env.example` como referencia.

- `VITE_API_URL`
  URL completa del backend terminada en `/api`
- `FRONTEND_URL`
  URL publica del frontend para redireccion y CORS del backend
- `APP_BASE_URL`
  URL publica del backend para servir archivos en `/uploads`

## API local

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/categories`
- `GET /api/cases`
- `GET /api/cases/:id`

## Despliegue gratis en Vercel + Render

### 1. Subir el backend a Render

- Crea una cuenta en [Render](https://render.com/free)
- Crea un nuevo `Web Service`
- Conecta tu repositorio
- Usa estos valores:
  - `Build Command`: `npm install`
  - `Start Command`: `npm run server`
- Configura variables:
  - `FRONTEND_URL=https://tu-frontend.vercel.app`
  - `APP_BASE_URL=https://tu-backend.onrender.com`
- Al desplegar, tu API quedara en una URL como:
  - `https://tu-backend.onrender.com/api/health`

### 2. Subir el frontend a Vercel

- Crea una cuenta en [Vercel](https://vercel.com/docs/accounts/plans/hobby)
- Importa el mismo repositorio
- Framework detectado: `Vite`
- Configura esta variable:
  - `VITE_API_URL=https://tu-backend.onrender.com/api`
- Despliega

### 3. Actualizar el backend con la URL del frontend

- Vuelve a Render
- Ajusta `FRONTEND_URL` con la URL real entregada por Vercel
- Redeploy del backend

## Recomendacion importante

- La carpeta `uploads/` funciona para demo y MVP.
- En hosting gratis, los archivos subidos pueden no ser permanentes despues de reinicios o nuevos deploys.
- Para produccion conviene mover evidencias a un storage externo como Cloudinary, Supabase Storage o S3 compatible.
