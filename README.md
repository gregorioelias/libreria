# Libreria Express (MVP Mobile-First)

App web pensada para librerias pequenas que hoy trabajan con Excel o papel.
Foco: busqueda instantanea, ubicacion fisica clara y carga rapida por ISBN desde celular.

## Stack

- Next.js (App Router) + Tailwind CSS
- API routes en Next.js
- Prisma ORM
- PostgreSQL
- Escaneo ISBN con `html5-qrcode`
- Metadata externa desde Open Library (fallback Google Books)

## Funcionalidades incluidas

- Busqueda en vivo por titulo, autor o ISBN
- Resultado con portada, autor, stock, ubicacion y precio opcional
- Estado visible por libro: `TENEMOS STOCK` o `SIN STOCK`
- Escaneo desde camara en smartphone
- Autocompletado por ISBN y formulario editable antes de guardar
- Carga rapida para escanear/guardar varios libros seguidos
- Dashboard simple:
  - cantidad total de libros
  - libros sin stock
  - ultimos agregados
- Seed con libros ficticios de demo

## Instalacion y ejecucion

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `DATABASE_URL` en `.env` (Postgres).

Ejemplo Neon (recomendado):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

3. Crear esquema + cliente Prisma + datos demo:

```bash
npm run db:setup
```

4. Levantar en desarrollo:

```bash
npm run dev
```

Abrir en:

- Local: `http://localhost:3000`
- Misma red local (celular): `http://TU_IP_LOCAL:3000`

## Abrir desde el celular en la misma red

1. Conecta PC y celular al mismo Wi-Fi.
2. Obtiene tu IP local de la PC (ejemplo `192.168.0.25`).
3. Inicia la app con `npm run dev`.
4. Abre en el celular `http://192.168.0.25:3000`.
5. Permite acceso a camara cuando el navegador lo solicite.

Si no abre desde celular, revisar firewall de Windows para permitir Node.js en red privada.

## Scripts utiles

- `npm run dev`: desarrollo
- `npm run build`: build de produccion
- `npm run start`: correr build
- `npm run lint`: lint
- `npm run db:generate`: generar cliente Prisma
- `npm run db:push`: sincronizar esquema en Postgres
- `npm run db:seed`: cargar datos demo
- `npm run db:setup`: generate + db push + seed

## Estructura

- `app/page.tsx`: interfaz principal mobile-first, buscador, scanner y carga
- `app/api/books/route.ts`: busqueda y guardado de libros
- `app/api/isbn/route.ts`: metadata ISBN (Open Library / Google Books)
- `app/api/dashboard/route.ts`: metricas de dashboard
- `app/api/scans/route.ts`: cola de escaneos en vivo (celu a PC)
- `prisma/schema.prisma`: modelos `Book` y `ScanDraft`
- `scripts/seed-db.mjs`: datos demo
- `lib/prisma.ts`: cliente Prisma reutilizable
