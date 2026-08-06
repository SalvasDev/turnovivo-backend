<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# TurnoVivo Backend

Backend de TurnoVivo construido con NestJS, Prisma 7, PostgreSQL y Redis.

## Requisitos previos

1. Node.js 20 o superior.
2. npm 10 o superior.
3. Docker Desktop encendido.

## Infraestructura local (PostgreSQL + Redis)

El archivo de infraestructura está en la raíz del workspace:
[docker-compose.yaml](../docker-compose.yaml)

Levanta la base de datos y Redis:

cd ../
docker compose up -d postgres redis

Verifica que estén arriba:

docker compose ps

Debes ver:
1. PostgreSQL en localhost:5433
2. Redis en localhost:6379

## Variables de entorno

Este proyecto usa el archivo:
[.env](.env)

Valores esperados para local:

DATABASE_URL="postgresql://turnovivo_admin:turnovivo_secret_pass_2026@localhost:5433/turnovivo_db?schema=public"
PORT=3000
JWT_SECRET="turnovivo_super_secret_key_2026_signature_hash"
JWT_EXPIRES_IN="1d"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="turnovivo_redis_pass_2026"
REDIS_MAX_RETRY_ATTEMPTS=3
REDIS_RETRY_BASE_DELAY_MS=200

## Instalación

Desde la carpeta backend:

cd turnovivo-backend
npm install

Nota: npm install dispara prisma generate vía postinstall.

## Migraciones y seed de Prisma

Aplica el esquema a la base:

npx prisma migrate deploy

Carga datos iniciales (usuarios y slots de ejemplo):

npx prisma db seed

Nota:
El seed crea agenda demo de varios días hacia adelante para evitar que la app quede sin turnos al día siguiente.

Puedes validar el estado de migraciones con:

npx prisma migrate status

## Arranque del backend

Modo desarrollo:

npm run start:dev

Build de verificación:

npm run build

El backend queda en:

http://localhost:3000

## Flujo recomendado para dejarlo funcionando de cero

Desde la raíz del repo, este flujo deja todo listo:

cd /Users/salvador.sanchez/Documents/Learning/practices/turno-vivo-v2
docker compose up -d postgres redis
cd turnovivo-backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev

## Demo backend en 5 minutos (soporte para portfolio)

Objetivo:
Dejar backend listo para que frontend pueda mostrar una experiencia completa sin ajustes manuales.

Pasos:
1. docker compose up -d postgres redis
2. cd turnovivo-backend
3. npm install
4. npx prisma migrate deploy
5. npx prisma db seed
6. npm run start:dev

Validación rápida (opcional):
1. Consultar negocio demo:
  curl -s http://localhost:3000/businesses/barberia-premium
2. Obtener id y validar slots disponibles:
  curl -s http://localhost:3000/appointments/business/<BUSINESS_ID>/available

Resultado esperado:
1. Endpoint de negocio responde 200.
2. Endpoint de slots devuelve arreglo con elementos (> 0).
3. Frontend puede autenticarse y renderizar cards sin reseed inmediato.

## Despliegue recomendado

Referencia completa:
[DEPLOYMENT.md](../DEPLOYMENT.md)

Para backend en producción:
1. Define `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET` y variables de Redis.
2. Ejecuta migraciones antes de arrancar.
3. Ejecuta seed solo una vez para preparar la demo inicial.
4. Arranca con `npm run start:prod`.

## Troubleshooting rápido

1. Error: tabla no existe (por ejemplo public.users o public.slot_blocks)
  Causa común: faltan migraciones.
  Solución:
  npx prisma migrate deploy

2. Error de Redis ECONNREFUSED o reconexiones infinitas
  Causa común: Docker apagado o Redis no levantado.
  Solución:
  cd ../
  docker compose up -d redis

3. Error EADDRINUSE en puerto 3000
  Causa común: otro proceso o contenedor usa 3000.
  Revisa qué usa el puerto:
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  Si es un contenedor no relacionado, detenlo por nombre:
  docker stop NOMBRE_CONTENEDOR

4. Error al arrancar desde la raíz del repo con npm run start:dev
  Causa: no existe package.json en la raíz.
  Solución: ejecuta start:dev desde [turnovivo-backend](.)

## Scripts útiles

1. npm run start:dev
2. npm run build
3. npm run test
4. npm run test:e2e
5. npm run lint

## Endpoints base de auth

1. POST /users (registro)
2. POST /auth/login
3. POST /auth/logout

## Credenciales semilla

Usuario staff:
barbero.estrella@turnovivo.com

Usuario customer:
cliente.real@turnovivo.com

Password:
password123

