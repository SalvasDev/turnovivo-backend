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

