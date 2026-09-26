#!/bin/sh
# Сборка Debug под iOS-симулятор → install → launch (CLI-дублёр MCP-инструментов
# симулятора; цикл проверки не зависит от MCP). Веб-часть должна быть уже
# собрана и синхронизирована — `npm run ios:sim` сам зовёт `npm run ios:build`.
#
#   npm run ios:sim                         # iPhone 17 Pro (или первый доступный iPhone)
#   IOS_SIM_UDID=<udid> npm run ios:sim     # конкретный симулятор
#   IOS_SIM_HEADLESS=1 npm run ios:sim      # не открывать окно Simulator.app
#
# Подпись симулятору не нужна (CODE_SIGNING_ALLOWED=NO) — команда разработчика и
# сертификаты для этой команды не требуются.
#
# -packageAuthorizationProvider netrc: по умолчанию SwiftPM ищет учётку github.com
# в связке ключей перед скачиванием бинарных артефактов capacitor-swift-pm — при
# сохранённом токене GitHub это модальный запрос доступа к Keychain, и
# неинтерактивная сборка висит на «Resolve Package Graph» бесконечно.
set -eu

cd "$(dirname "$0")/../.."

PROJECT=ios/App/App.xcodeproj
# DerivedData — вне дерева исходников (гигабайт артефактов не лезет в
# Vite-вотчер и grep), но свой на каждый checkout/worktree: параллельные сборки
# из разных worktree не делят каталог.
DERIVED="${IOS_DERIVED_DATA:-$HOME/Library/Developer/Xcode/DerivedData/portuguese-ios-$(pwd | shasum | cut -c1-8)}"
APP="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"

if [ ! -f ios/App/App/public/index.html ]; then
  echo "✖ Нет веб-бандла в ios/App/App/public — сначала: npm run ios:build" >&2
  exit 1
fi

UDID="${IOS_SIM_UDID:-}"
if [ -z "$UDID" ]; then
  # Предпочитаем уже запущенный iPhone, затем «iPhone 17 Pro», затем любой iPhone.
  UDID=$(xcrun simctl list devices available -j | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const all = Object.values(JSON.parse(s).devices).flat()
        .filter((d) => d.isAvailable && d.name.startsWith("iPhone"));
      const pick = all.find((d) => d.state === "Booted")
        ?? all.find((d) => d.name === "iPhone 17 Pro")
        ?? all[0];
      if (pick) process.stdout.write(pick.udid);
    });')
fi
if [ -z "$UDID" ]; then
  echo "✖ Не найден доступный iPhone-симулятор (Xcode → Settings → Components)" >&2
  exit 1
fi
echo "▸ Симулятор: $UDID"

# bootstatus -b сам загружает выключенный симулятор и ждёт полной загрузки.
xcrun simctl bootstatus "$UDID" -b >/dev/null
if [ "${IOS_SIM_HEADLESS:-}" != "1" ]; then
  open -a Simulator --args -CurrentDeviceUDID "$UDID" || true
fi

echo "▸ xcodebuild (Debug, iphonesimulator)…"
xcodebuild \
  -project "$PROJECT" \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED" \
  -packageAuthorizationProvider netrc \
  CODE_SIGNING_ALLOWED=NO \
  -quiet \
  build

# Bundle ID — из собранного приложения (источник — capacitor.config.ts → проект).
BID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")
echo "▸ install + launch $BID"
xcrun simctl terminate "$UDID" "$BID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BID"
echo "✔ Запущено на $UDID"
