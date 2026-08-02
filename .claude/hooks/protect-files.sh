#!/bin/bash
# Himoyalangan fayllarni Claude tahrirlashidan saqlaydi.
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0

# Mavjud migratsiyalar tahrirlanmaydi (yangi migratsiya yaratiladi),
# lock fayllar va .env'lar qo'lda boshqariladi.
# .env.example — commit qilinadigan shablon, maxfiy emas: bloklanmaydi.
case "$FILE" in
*.env.example | *.env.sample) exit 0 ;;
esac

if echo "$FILE" | grep -qE '(prisma/migrations/.+/migration\.sql|pnpm-lock\.yaml|\.env)'; then
  echo "BLOKLANDI: '$FILE' himoyalangan fayl. Migratsiya o'zgartirish kerak bo'lsa YANGI migratsiya yarat." >&2
  exit 2
fi
exit 0
