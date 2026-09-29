#!/bin/sh
# Релиз iOS: веб-бандл (прод Convex) → Xcode archive → export с загрузкой в
# App Store Connect (появится в TestFlight через 5–15 мин обработки).
# ЗАПУСКАЕТ ВЛАДЕЛЕЦ после ревью: обращение к Apple от имени аккаунта.
#
#   npm run ios:release              # релиз
#   sh scripts/ios/release.sh --check  # только проверить настройку, без сборки
#
# Нужен .env.ios-release.local (образец — .env.ios-release.example): IOS_TEAM_ID,
# ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH. Прод-URL Convex — в коммитнутом
# .env.ios-release. Не настроено — скрипт печатает, что сделать, и выходит с
# кодом 2 («ещё не настроено», не сбой).
set -eu

cd "$(dirname "$0")/../.."

ENV_FILE=.env.ios-release.local
PROD_ENV_FILE=.env.ios-release
BUILD_DIR=ios/App/build/release
ARCHIVE="$BUILD_DIR/App.xcarchive"
PROJECT=ios/App/App.xcodeproj
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

handoff() {
  cat <<'TXT'
─── TestFlight: что нужно один раз (≈15 минут, веб-интерфейсы Apple с 2FA) ───
1. developer.apple.com → Certificates, Identifiers & Profiles:
   • Identifiers → «+» → App IDs → App → Bundle ID (Explicit)
     io.github.ksenyagorbatova.portuguese (из capacitor.config.ts) — без него
     форма New App (шаг 2) этот Bundle ID не предложит;
   • Devices — если у команды нет ни одного устройства, добавь свой iPhone
     (UDID: Finder → iPhone → серийный номер по клику): автоподпись архива
     берёт development-профиль, а Apple выдаёт его только команде с устройством.
2. App Store Connect → Apps → «+» → New App: iOS, имя «Português», язык Russian,
   Bundle ID из шага 1, SKU любой.
3. App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → «+», роль App Manager. Скачай .p8 (даётся один раз) в
   ~/.appstoreconnect/private_keys/, запиши Key ID и Issuer ID.
4. cp .env.ios-release.example .env.ios-release.local и заполни значения;
   проверка без сборки: sh scripts/ios/release.sh --check
5. npm run ios:release
TXT
}

# Значение KEY из env-файла — последняя строка вида KEY=VALUE. Файл НЕ
# исполняется (`.`/source выполнил бы его как shell: плейсхолдер «<you>» —
# редирект, пробел — команда). Кавычки вокруг значения снимаются, ведущий ~/
# раскрывается в $HOME, CRLF не мешает.
env_value() { # файл ключ
  val=$(tr -d '\r' <"$1" | sed -n "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*//p" | tail -n 1 | sed 's/[[:space:]]*$//')
  case "$val" in
    \"*\") val=${val#\"}; val=${val%\"} ;;
    \'*\') val=${val#\'}; val=${val%\'} ;;
  esac
  case "$val" in
    "~/"*) val="$HOME/${val#\~/}" ;;
  esac
  printf '%s' "$val"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "✖ Нет $ENV_FILE — релиз ещё не настроен."
  handoff
  exit 2
fi

IOS_TEAM_ID=$(env_value "$ENV_FILE" IOS_TEAM_ID)
ASC_KEY_ID=$(env_value "$ENV_FILE" ASC_KEY_ID)
ASC_ISSUER_ID=$(env_value "$ENV_FILE" ASC_ISSUER_ID)
ASC_KEY_PATH=$(env_value "$ENV_FILE" ASC_KEY_PATH)

missing=""
[ -n "$IOS_TEAM_ID" ] || missing="$missing IOS_TEAM_ID"
[ -n "$ASC_KEY_ID" ] || missing="$missing ASC_KEY_ID"
[ -n "$ASC_ISSUER_ID" ] || missing="$missing ASC_ISSUER_ID"
[ -n "$ASC_KEY_PATH" ] || missing="$missing ASC_KEY_PATH"
if [ -n "$missing" ]; then
  echo "✖ В $ENV_FILE не заданы:$missing"
  handoff
  exit 2
fi
# Team ID и Key ID — ровно 10 символов A–Z/0–9 (Team ID ещё и подставляется в
# ExportOptions.plist через sed — посторонние символы туда не пускаем).
case "$IOS_TEAM_ID" in
  *[!A-Z0-9]*) bad_team=1 ;;
  *) bad_team=0 ;;
esac
if [ "$bad_team" = 1 ] || [ ${#IOS_TEAM_ID} -ne 10 ]; then
  echo "✖ IOS_TEAM_ID «${IOS_TEAM_ID}» — не Team ID (нужно 10 символов A–Z/0–9, напр. G2AA82378K)."
  exit 2
fi
case "$ASC_KEY_ID" in
  *[!A-Z0-9]*) bad_key=1 ;;
  *) bad_key=0 ;;
esac
if [ "$bad_key" = 1 ] || [ ${#ASC_KEY_ID} -ne 10 ]; then
  echo "✖ ASC_KEY_ID «${ASC_KEY_ID}» — не Key ID ключа API (10 символов A–Z/0–9)."
  exit 2
fi
case "$ASC_ISSUER_ID" in
  *[!0-9a-fA-F-]*)
    echo "✖ ASC_ISSUER_ID «${ASC_ISSUER_ID}» — не Issuer ID (UUID из App Store Connect)."
    exit 2
    ;;
esac
if [ ! -f "$ASC_KEY_PATH" ]; then
  echo "✖ Нет файла ключа App Store Connect: $ASC_KEY_PATH"
  handoff
  exit 2
fi

# Прод-URL — только из коммитнутого .env.ios-release (VITE_CONVEX_URL из
# .env.ios-release.local игнорируется: экспорт ниже сильнее любых .env-файлов).
VITE_CONVEX_URL=$(env_value "$PROD_ENV_FILE" VITE_CONVEX_URL 2>/dev/null || true)
case "$VITE_CONVEX_URL" in
  https://*.convex.cloud) ;;
  *)
    echo "✖ $PROD_ENV_FILE: VITE_CONVEX_URL должен быть прод-деплоем вида https://<name>.convex.cloud"
    exit 2
    ;;
esac
if [ -n "$(env_value "$ENV_FILE" VITE_CONVEX_URL)" ]; then
  echo "⚠ VITE_CONVEX_URL в $ENV_FILE игнорируется — прод-URL берётся из $PROD_ENV_FILE."
fi

if [ "$CHECK_ONLY" = 1 ]; then
  echo "✔ Настройка релиза в порядке: команда $IOS_TEAM_ID, ключ $ASC_KEY_ID, Convex $VITE_CONVEX_URL."
  exit 0
fi

# 1) Веб-бандл. Переменная окружения процесса у Vite сильнее .env-файлов, так
#    что dev-URL из .env.local не перебьёт прод. Проверяем результат явно.
echo "▸ vite build --mode ios-release (Convex: $VITE_CONVEX_URL)"
export VITE_CONVEX_URL
npx vite build --mode ios-release
if ! grep -qF "$VITE_CONVEX_URL" dist-ios/assets/*.js; then
  echo "✖ В бандле dist-ios нет $VITE_CONVEX_URL — релиз остановлен."
  exit 1
fi
if [ -f .env.local ]; then
  DEV_URL=$(env_value .env.local VITE_CONVEX_URL)
  if [ -n "$DEV_URL" ] && [ "$DEV_URL" != "$VITE_CONVEX_URL" ] && grep -qF "$DEV_URL" dist-ios/assets/*.js; then
    echo "✖ В релизный бандл попал dev-URL $DEV_URL — релиз остановлен."
    exit 1
  fi
fi
npx cap sync ios

# 2) Архив. -allowProvisioningUpdates + ключ API: Xcode сам создаёт/обновляет
#    App ID, сертификат и профиль (automatic signing), без входа в Xcode.
#    netrc — SwiftPM не лезет в Keychain за учёткой github.com (иначе висит).
mkdir -p "$BUILD_DIR"
echo "▸ xcodebuild archive (team $IOS_TEAM_ID)"
if ! xcodebuild \
  -project "$PROJECT" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -packageAuthorizationProvider netrc \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  DEVELOPMENT_TEAM="$IOS_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  archive; then
  echo "✖ archive не удался. Если это provisioning/signing — проверь IOS_TEAM_ID"
  echo "  (вторая команда на машине: 2GJM94F693) и роль ключа API (App Manager)."
  echo "  «Your team has no devices…» — добавь устройство (шаг 1 ниже)."
  handoff
  exit 1
fi

# 3) Экспорт с загрузкой в App Store Connect (destination = upload).
sed "s/__TEAM_ID__/$IOS_TEAM_ID/" scripts/ios/ExportOptions.plist > "$BUILD_DIR/ExportOptions.plist"
echo "▸ xcodebuild -exportArchive → App Store Connect"
if ! xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
  -exportPath "$BUILD_DIR/export" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"; then
  echo "✖ Загрузка не удалась. «No suitable application records» — нет записи"
  echo "  приложения в App Store Connect (шаг 2 ниже)."
  handoff
  exit 1
fi

echo "✔ Сборка загружена в App Store Connect. Через 5–15 минут обработки она"
echo "  появится в TestFlight: добавь тестеров (Internal — без ревью)."
