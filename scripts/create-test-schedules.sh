#!/bin/bash

# Skrypt do tworzenia testowych grafików dla pierwszego użytkownika
# Usage: ./scripts/create-test-schedules.sh

echo "📅 Tworzenie testowych grafików..."

# Pobierz pierwszego użytkownika z bazy
USER_ID=$(curl -s "http://localhost:3001/api/racs/mappings" | jq -r '.data[0].user_id')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo "❌ Nie znaleziono użytkownika. Sprawdź czy są mapowania."
  exit 1
fi

echo "✅ Znaleziono użytkownika: $USER_ID"
echo "📊 Tworzę grafiki dla lutego 2026..."

# Twórz grafiki dla lutego 2026 (pn-pt, 8:00-16:00)
for day in {1..28}; do
  DATE=$(date -d "2026-02-$day" +%Y-%m-%d 2>/dev/null)
  DAY_OF_WEEK=$(date -d "$DATE" +%u 2>/dev/null)

  # Pomiń weekendy (6=sobota, 7=niedziela)
  if [ "$DAY_OF_WEEK" -ge 6 ]; then
    continue
  fi

  curl -s -X POST http://localhost:3001/api/schedules \
    -H "Content-Type: application/json" \
    -d "{
      \"user_id\": \"$USER_ID\",
      \"schedule_date\": \"$DATE\",
      \"shift_start\": \"08:00:00\",
      \"shift_end\": \"16:00:00\",
      \"shift_type\": \"standard\"
    }" > /dev/null

  echo "  ✓ $DATE"
done

echo ""
echo "✅ Grafiki utworzone pomyślnie!"
echo ""
echo "🔍 Sprawdź grafiki:"
echo "   curl \"http://localhost:3001/api/schedules?userId=$USER_ID&month=2026-02\" | jq"
