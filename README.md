# 🦷 Dental Clinic Administration

Система автоматизации работы стоматологической клиники.

---

## 🛠 Стек технологий

| Слой | Технология |
|------|-----------|
| Фронтенд | React 19, TypeScript, Tailwind CSS, Recharts |
| Бэкенд | Node.js, Express |
| База данных | **PostgreSQL** (Prisma ORM) |
| Авторизация | **JWT** + bcrypt |
| Деплой | **Vercel** |

---

## 📋 Что нужно для запуска

### 1. Завести PostgreSQL

Рекомендуется **Neon** (бесплатный):
1. [neon.tech](https://neon.tech) → Sign Up → New Project
2. Скопировать Connection string: `postgresql://user:pass@host/dbname?sslmode=require`

Альтернативы: Supabase, Railway, PlanetScale.

### 2. Локальный запуск

```bash
npm install
cp .env.example .env       # Заполнить DATABASE_URL и JWT_SECRET
npx prisma migrate deploy  # Создать таблицы в БД
npm run db:seed            # Загрузить начальные данные
npm run dev                # http://localhost:3000
```

### 3. Файл .env

```env
DATABASE_URL="postgresql://USER:PASS@HOST/dental_clinic?sslmode=require"
JWT_SECRET="минимум_32_случайных_символа"
NODE_ENV="development"
PORT=3000
APP_URL="http://localhost:3000"
```

Сгенерировать JWT_SECRET: `openssl rand -hex 32`

---

## 🚀 Деплой на Vercel

### Шаг 1 — Загрузить на GitHub

```bash
git init && git add . && git commit -m "Initial"
# Залить на GitHub
```

### Шаг 2 — Подключить к Vercel

1. [vercel.com](https://vercel.com) → New Project → Import GitHub репо
2. Framework Preset: **Other**
3. Build Command: `npm run build`
4. Output Directory: `dist`

### Шаг 3 — Переменные в Vercel (Settings → Environment Variables)

| Ключ | Значение |
|------|---------|
| `DATABASE_URL` | Connection string из Neon |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `NODE_ENV` | `production` |
| `APP_URL` | URL деплоя после первого запуска |

### Шаг 4 — Применить миграцию и seed (один раз)

```bash
npm i -g vercel
vercel env pull .env.production
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2-) npx prisma migrate deploy
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2-) npm run db:seed
```

---

## 👤 Учётные данные (после seed)

| Роль | Логин | Пароль |
|------|-------|--------|
| Главный врач | `admin` | `Admin@2024!` |
| Администратор | `admin_maria` | `Maria@2024!` |
| Врач | `dr_jenkins` | `Jenkins@2024!` |
| Врач | `dr_chen` | `Chen@2024!` |
| Врач | `dr_taylor` | `Taylor@2024!` |

> ⚠️ Смените пароли после первого входа!

---

## 🔧 Команды

```bash
npm run dev           # Dev-режим
npm run build         # Сборка продакшена
npm run db:seed       # Начальные данные
npm run db:studio     # Prisma Studio (GUI для БД)
```

---

## 🔒 Исправленные уязвимости

- ✅ Пароли хэшируются через bcrypt (cost 12)
- ✅ JWT с истечением 8 часов (вместо глобальной переменной)
- ✅ Все API-маршруты защищены requireAuth middleware
- ✅ Разграничение прав по ролям (CHIEF_DOCTOR / ADMINISTRATOR / DOCTOR)
- ✅ Валидация входных данных через Zod
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options)
- ✅ CORS настроен на конкретный origin
- ✅ Аудит-лог в PostgreSQL без обрезки
- ✅ Conflict detection для записей через SQL запросы

---

## 🏗 Структура

```
dental-clinic/
├── prisma/
│   ├── schema.prisma         # Схема БД
│   └── migrations/           # SQL миграции
├── server/
│   ├── prisma.ts             # Prisma Client singleton
│   ├── auth.ts               # JWT middleware
│   ├── audit.ts              # Аудит helper
│   ├── notify.ts             # Уведомления helper
│   ├── seed.ts               # Начальные данные
│   └── routes/               # Express роутеры
├── src/
│   ├── types.ts              # TypeScript типы
│   ├── utils/api.ts          # Фронтенд API клиент
│   └── components/           # React компоненты
├── server.ts                 # Точка входа
├── vercel.json               # Vercel конфиг
└── .env.example
```
