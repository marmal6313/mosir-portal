/**
 * Skrypt do tworzenia grafików pracy dla użytkowników
 * Usage: node scripts/create-schedules.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createSchedules() {
  console.log('\n📅 Generator grafików pracy\n');

  // Pobierz dane od użytkownika
  const userId = await question('Podaj UUID użytkownika: ');
  const month = await question('Podaj miesiąc (YYYY-MM, np. 2026-02): ');
  const shiftStart = await question('Godzina rozpoczęcia (HH:MM:SS, np. 08:00:00): ') || '08:00:00';
  const shiftEnd = await question('Godzina zakończenia (HH:MM:SS, np. 16:00:00): ') || '16:00:00';
  const skipWeekends = await question('Pomiń weekendy? (t/n): ');

  console.log('\n⏳ Tworzę grafiki...\n');

  // Parse month
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const schedules = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthNum - 1, day);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    // Sprawdź czy to weekend
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (skipWeekends.toLowerCase() === 't' && isWeekend) {
      // Pomiń weekend całkowicie
      continue;
    }

    schedules.push({
      user_id: userId,
      schedule_date: dateStr,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      shift_type: 'standard',
      is_day_off: isWeekend, // Jeśli nie pomijamy, oznacz jako dzień wolny
    });
  }

  console.log(`📊 Wygenerowano ${schedules.length} grafików dla miesiąca ${month}\n`);

  // Wyślij do API
  try {
    const response = await fetch('http://localhost:3001/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedules),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Grafiki zostały utworzone pomyślnie!');
      console.log(`📝 Utworzono: ${Array.isArray(result.data) ? result.data.length : 1} grafików\n`);
    } else {
      console.error('❌ Błąd:', result.error);
    }
  } catch (error) {
    console.error('❌ Błąd połączenia:', error.message);
  }

  rl.close();
}

// Uruchom
createSchedules().catch(console.error);
