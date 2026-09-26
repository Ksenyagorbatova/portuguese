#!/bin/sh
# Релиз iOS: веб-бандл (прод Convex) → Xcode archive → export с загрузкой в
# App Store Connect (появится в TestFlight через 5–15 мин обработки).
# ЗАПУСКАЕТ ВЛАДЕЛЕЦ после ревью: обращение к Apple от имени аккаунта.
#
#   npm run ios:release
#
# Нужен .env.ios-release.local (образец — .env.ios-release.example): IOS_TEAM_ID,
# ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, VITE_CONVEX_URL. Без него скрипт
# печатает, что сделать, и выходит с кодом 2 («ещё не настроено», не сбой).
set -eu

cd "$(dirname "$0")/../.."

ENV_FILE=.env.ios-release.local
BUILD_DIR=ios/App/build/release
ARCHIVE="$BUILD_DIR/App.xcarchive"
PROJECT=ios/App/App.xcodeproj

handoff() {
  cat <<'TXT'
─── TestFlight: что нужно один раз (≈10 минут, веб-интерфейсы Apple с 2FA) ───
1. App Store Connect → Apps → «+» → New App: iOS, имя «Português», язык Russian,
   Bundle ID io.github.ksenyagorbatova.portuguese (из capacitor.config.ts), SKU любой.
   (App ID на developer.apple.com создастся автоматически при первом archive
   с ключом API — или заведи вручную в Identifiers.)
2. App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → «+», роль App Manager. Скачай .p8 (даётся один раз) в
   ~/.appstoreconnect/private_keys/, запиши Key ID и Issuer ID.
3. cp .env.ios-release.example .env.ios-release.local и заполни значения.
4. npm run ios:release
TXT
}

if [ ! -f "$ENV_FILE" ]; then
  echo "✖ Нет $ENV_FILE — релиз ещё не настроен."
  handoff
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

missing=""
for v in IOS_TEAM_ID ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH VITE_CONVEX_URL; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || missing="$missing $v"
done
if [ -n "$missing" ]; then
  echo "✖ В $ENV_FILE не заданы:$missing"
  handoff
  exit 2
fi
if [ ! -f "$ASC_KEY_PATH" ]; then
  echo "✖ Нет файла ключа App Store Connect: $ASC_KEY_PATH"
  handoff
  exit 2
fi
case "$VITE_CONVEX_URL" in
  https://*.convex.cloud) ;;
  *)
    echo "✖ VITE_CONVEX_URL должен быть прод-деплоем вида https://<name>.convex.cloud"
    exit 2
    ;;
esac

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
  DEV_URL=$(sed -n 's/^VITE_CONVEX_URL=//p' .env.local | tr -d "\"' ")
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
  echo "  приложения в App Store Connect (шаг 1 ниже)."
  handoff
  exit 1
fi

echo "✔ Сборка загружена в App Store Connect. Через 5–15 минут обработки она"
echo "  появится в TestFlight: добавь тестеров (Internal — без ревью)."
