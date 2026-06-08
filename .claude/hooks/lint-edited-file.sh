#!/bin/sh
# PostToolUse(Write|Edit) хук: линтит ТОЛЬКО что отредактированный TS-файл и
# возвращает ошибки агенту (exit 2 → stderr уходит в контекст Claude), чтобы он
# чинил их сразу в цикле, не дожидаясь pre-push. Это подсказка, не гейт коммита.
#
# Читает JSON хука со stdin, берёт tool_input.file_path. Линтит только src/** и
# convex/** (.ts/.tsx), кроме convex/_generated. Линтер — oxlint, если есть
# .oxlintrc.json (после миграции на oxlint), иначе eslint. Если линтер не
# установлен — тихо выходит (не мешает работе).

input=$(cat)

# file_path из JSON хука: jq (если есть), иначе node — оба честно парсят JSON.
# Regex по JSON ненадёжен: при Edit поля old/new_string могут содержать свой
# "file_path", а жадный sed вернул бы не тот путь. node в проекте есть всегда.
if command -v jq >/dev/null 2>&1; then
  file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
else
  file=$(printf '%s' "$input" | node -e 'try{const i=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write((i.tool_input&&i.tool_input.file_path)||"")}catch(e){}')
fi
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

case "$file" in
  */convex/_generated/*) exit 0 ;;
  */src/*.ts | */src/*.tsx | */convex/*.ts) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

if [ -f .oxlintrc.json ] && [ -x node_modules/.bin/oxlint ]; then
  out=$(node_modules/.bin/oxlint "$file" 2>&1)
  status=$?
elif [ -x node_modules/.bin/eslint ]; then
  out=$(node_modules/.bin/eslint "$file" 2>&1)
  status=$?
else
  exit 0 # линтер не установлен — не мешаем
fi

if [ "$status" -ne 0 ]; then
  printf 'Линтер нашёл проблемы в %s — почини, прежде чем продолжать:\n%s\n' "$file" "$out" >&2
  exit 2
fi
exit 0
