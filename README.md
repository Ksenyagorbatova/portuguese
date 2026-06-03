# Português A0–A1 — тренажёр

Тренажёр европейского португальского (уровень A0–A1) с русским интерфейсом:
интервальное повторение (SM-2 / метод Эббингауза), 4 типа упражнений, теория с
озвучкой, кросс-предложения из нескольких тем.

**Стек:** React + TypeScript + Vite (фронтенд, статика на GitHub Pages) ·
Convex (БД + функции + авторизация). Деплой автоматический по пушу в `main`.

- Сайт: `https://ksenyagorbatova.github.io/portuguese/`
- Контент (темы, слова, теория, предложения) лежит в БД, источник правды —
  [`convex/content.ts`](convex/content.ts), заливается идемпотентным сидом.
- Прогресс per-user, синхронизируется между устройствами (вход по email/паролю;
  опционально GitHub/Google).

---

## Локальная разработка

```bash
npm install

# 1) В первом терминале — Convex (создаст проект при первом запуске, спросит логин):
npx convex dev          # генерирует convex/_generated, пишет VITE_CONVEX_URL в .env.local

# 2) Сгенерировать ключи авторизации (один раз на проект):
npx @convex-dev/auth     # создаёт JWT_PRIVATE_KEY / JWKS в env деплоя

# 3) Залить контент в локальную БД:
npx convex run seed:seedContent

# 4) Во втором терминале — фронтенд:
npm run dev             # http://localhost:5173/portuguese/
```

> Для локального входа по email/паролю на dev-деплое установи `SITE_URL`:
> `npx convex env set SITE_URL http://localhost:5173`

### Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | Vite dev-сервер |
| `npm run dev:convex` | `convex dev` (бэкенд + кодоген) |
| `npm run build` | `tsc -b` + `vite build` + копия `404.html` |
| `npm run lint` | проверка типов (`tsc -b`) |

---

## Как добавлять контент

1. Отредактируй [`convex/content.ts`](convex/content.ts) (`TOPICS` / `CROSS_SENTENCES`).
2. Правила стабильности (иначе потеряется прогресс пользователей):
   - не меняй существующие `lesson.id` (lessonKey) и `word.pt` — прогресс завязан на `(lessonKey, pt)`;
   - кросс-предложения **только дописывай в конец** (их ключ `cs_NNNN` берётся из индекса).
3. Локально проверь: `npx convex run seed:seedContent`.
4. `git push` в `main` → CI задеплоит и пере-сидит прод (сид идемпотентный — дубликатов не будет).

---

## Разовая настройка деплоя (вручную)

### A. GitHub Pages
- Settings → Pages → **Build and deployment → Source = GitHub Actions**.
- Сайт будет на `https://ksenyagorbatova.github.io/portuguese/` (подпуть `/portuguese/`
  уже прописан в [`vite.config.ts`](vite.config.ts)).

### B. Convex prod + deploy key
1. `npx convex dev` локально (создаёт проект и dev-деплой) или создай проект в дашборде.
2. Dashboard → проект → **Production** → Settings → **Deploy Keys** → Generate Production Deploy Key.
3. GitHub → репозиторий → Settings → **Secrets and variables → Actions** → New secret:
   `CONVEX_DEPLOY_KEY` = сгенерированный ключ.
4. Запиши prod-URL (`*.convex.cloud`) и его `.site`-двойник (`*.convex.site`).

### C. Ключи авторизации
- `npx @convex-dev/auth` — генерирует `JWT_PRIVATE_KEY` и `JWKS` в env прод-деплоя.
  Без этого вход не работает.

### D. SITE_URL (прод)
```bash
npx convex env set SITE_URL https://ksenyagorbatova.github.io/portuguese --prod
```
⚠️ Обязательно с подпутём `/portuguese`, иначе после входа редиректит в корень и будет 404.

### E. (Опционально) OAuth GitHub/Google
Нужно, только если хочешь кнопки входа через GitHub/Google помимо email/пароля.
1. Создай OAuth-приложение. **Callback указывает на Convex, не на Pages:**
   - GitHub: `https://<prod>.convex.site/api/auth/callback/github`
   - Google: `https://<prod>.convex.site/api/auth/callback/google`
2. Положи креды в env: `npx convex env set AUTH_GITHUB_ID ... --prod` (и `_SECRET`, аналогично Google).
3. Раскомментируй провайдеры в [`convex/auth.ts`](convex/auth.ts).
4. Поставь `OAUTH_ENABLED = true` в [`src/components/SignIn.tsx`](src/components/SignIn.tsx).

---

## Как работает CI

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) на каждый пуш в `main`:
1. `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`
   — деплоит функции/схему в прод, генерит `_generated`, собирает фронт с прод-URL.
2. `npx convex run seed:seedContent --prod` — заливает/обновляет контент.
3. Публикует `dist/` на GitHub Pages.

Единственный секрет — `CONVEX_DEPLOY_KEY`.

---

## Известные компромиссы

- **Офлайн:** в отличие от исходной одно-файловой версии (всё в `localStorage`),
  Convex требует сети. До первой загрузки данных показывается экран загрузки.
  Возможное улучшение на будущее — PWA/service-worker кэш (не реализовано).
- **Streak** теперь увеличивается при первом *ответе* за день (а не при открытии).
- Проверка ответа — на клиенте; сервер доверяет присланному `quality`
  (нормально для учебного приложения).
