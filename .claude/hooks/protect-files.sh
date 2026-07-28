#!/bin/bash
# Himoyalangan fayllarni Claude tahrirlashidan saqlaydi.
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0

# Mavjud migratsiyalar tahrirlanmaydi (yangi migratsiya yaratiladi),
# lock fayllar va .env'lar qo'lda boshqariladi.
if echo "$FILE" | grep -qE '(prisma/migrations/.+/migration\.sql|pnpm-lock\.yaml|\.env)'; then
  echo "BLOKLANDI: '$FILE' himoyalangan fayl. Migratsiya o'zgartirish kerak bo'lsa YANGI migratsiya yarat." >&2
  exit 2
fi
exit 0
