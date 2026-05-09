# 🚀 Локальний запуск n8n Backup Manager

Цей документ описує, як запустити програму локально для розробки **без Docker**.

---

## Вимоги

| Інструмент | Версія    | Перевірка             |
|------------|-----------|----------------------|
| Node.js    | ≥ 18.x    | `node --version`     |
| npm        | ≥ 9.x     | `npm --version`      |
| Docker     | будь-яка  | потрібен для бекапів |

> **Примітка щодо Docker та n8n:** 
> - **Для розробки UI** Docker необов'язковий. Ви можете редагувати код і бачити зміни в інтерфейсі без нього.
> - **Для створення реальних бекапів** локальний n8n Backup Manager зможе підключитися **тільки до локального Docker Desktop**, де має бути встановлений ваш тестовий n8n. 
> - ⚠️ **Локальна копія не зможе підключитися до віддаленого VPS** (де встановлено ваш бойовий n8n), оскільки у неї немає доступу до серверного Docker-сокету. Для роботи з бойовим n8n встановлюйте Backup Manager безпосередньо на VPS.

---

## Перший запуск

### 1. Клонувати репозиторій (якщо ще не зроблено)

```bash
git clone https://github.com/aleksnero/n8n-backup-manager.git
cd n8n-backup-manager
```

### 2. Встановити залежності

Одна команда встановлює пакети для кореня, сервера і клієнта:

```bash
npm run install:all
```

> Детально: встановлює `concurrently` у корені, потім залежності сервера і клієнта.

### 3. Створити файл `.env`

Скопіюй шаблон і відредагуй:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# або Linux/Mac
cp .env.example .env
```

Відкрий `.env` і налаштуй:

```env
PORT=3000
JWT_SECRET=будь-який-довгий-рядок-для-підпису-токенів
```

> `JWT_SECRET` може бути будь-яким рядком (мінімум 16 символів). Наприклад: `my-local-dev-secret-2025`

---

## Запуск

```bash
npm run dev
```

Це запустить паралельно:
- **SERVER** → `http://localhost:3000` (Node.js + Express)
- **CLIENT** → `http://localhost:5173` (Vite dev server з HMR)

Відкрий у браузері: **http://localhost:5173**

### Вивід у термінал

```
[SERVER] Server running on port 3000
[CLIENT] VITE v5.x ready in 500ms
[CLIENT]   ➜  Local:   http://localhost:5173/
```

---

## Авторизація

При першому запуску сервер автоматично створює адміністратора:

| Поле     | Значення  |
|----------|-----------|
| Логін    | `admin`   |
| Пароль   | `admin`   |

> ⚠️ Змін пароль після першого входу у **Settings → Change Password**.

---

## Структура проекту

```
n8n-backup-manager/
├── package.json          ← кореневий (npm run dev)
├── .env                  ← локальні змінні середовища (не в git)
├── .env.example          ← шаблон
├── client/               ← React + Vite (фронтенд)
│   ├── src/
│   │   ├── pages/        ← сторінки (Dashboard, Backups, Settings...)
│   │   ├── components/   ← спільні компоненти (ConfirmModal, Layout...)
│   │   └── context/      ← React Context (Auth, Language, Toast)
│   └── vite.config.js    ← proxy /api → :3000
└── server/               ← Node.js + Express (бекенд)
    ├── index.js          ← точка входу
    ├── routes/           ← API маршрути
    ├── services/         ← бізнес-логіка
    └── data/             ← SQLite база даних (створюється автоматично)
```

---

## Як працює proxy

У режимі розробки Vite (`:5173`) проксує всі запити `/api/*` на сервер `:3000`:

```
Browser :5173 → /api/backups → Vite proxy → localhost:3000/api/backups
```

Це налаштовано у `client/vite.config.js` і не потребує змін у коді.

---

## Часті проблеми

### ❌ `Error: listen EADDRINUSE :::3000`
Порт 3000 зайнятий. Зупини інший процес або зміни `PORT=3001` у `.env`.

### ❌ `Cannot find module 'concurrently'`
Не встановлені кореневі залежності. Виконай:
```bash
npm install
```

### ❌ Сторінка показує "Loading..." вічно
Сервер не запустився. Перевір вивід у термінал — шукай помилки в рядках `[SERVER]`.

### ❌ 401 Unauthorized при будь-якому запиті
Очисти `localStorage` браузера або відкрий у режимі інкогніто.

### ❌ Docker-команди не працюють (бекап падає)
У режимі локальної розробки Docker-сокет може бути недоступний. Переконайся, що Docker Desktop запущений.

---

## Корисні команди

```bash
# Тільки сервер (без клієнта)
npm start --prefix server

# Скинути пароль адміна
node server/reset_password.js

# Перевірити стан бази даних
node server/check_db.js
```

---

## Відмінність від production (Docker)

| Аспект           | Локально (dev)            | Production (Docker)          |
|------------------|---------------------------|------------------------------|
| Запуск           | `npm run dev`             | `docker compose up -d`       |
| Клієнт           | Vite HMR `:5173`          | Зібрані файли через Express  |
| Hot Reload       | ✅ є                      | ❌ немає                     |
| Docker для backup| потрібен на хості         | всередині стека              |
| Змінні середовища| `.env` у корені           | `docker-compose.yml`         |
