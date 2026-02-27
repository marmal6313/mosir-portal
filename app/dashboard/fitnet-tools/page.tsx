import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import FitnetLoadStatus from '@/components/fitnet/LoadStatus';
import { Database, Server, HardDrive, AlertCircle } from 'lucide-react';

export const metadata = {
  title: 'Narzędzia Fitnet | Drabio',
  description: 'Narzędzia do zarządzania integracją z bazą Fitnet',
};

export default async function FitnetToolsPage() {
  const supabase = createServerClient();

  // Sprawdź czy użytkownik jest zalogowany
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Sprawdź czy użytkownik to superadmin
  const { data: userProfile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (!userProfile || userProfile.role !== 'superadmin') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Narzędzia Fitnet</h1>
        </div>
        <p className="text-gray-600">
          Zarządzanie integracją z bazą danych systemu sprzedażowego Fitnet
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Zalogowany jako: <span className="font-medium">{userProfile.full_name}</span>{' '}
          (superadmin)
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900 mb-1">
              ⚠️ Uwaga: Dostęp tylko dla superadmin
            </p>
            <p className="text-yellow-800">
              Te narzędzia pozwalają na sprawdzanie statusu bazy produkcyjnej Fitnet.
              Używaj ostrożnie i tylko gdy jest to konieczne. Wszystkie operacje backupu
              powinny być wykonywane poza godzinami szczytu (najlepiej w nocy lub w
              weekend).
            </p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {/* Load Status Section */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <FitnetLoadStatus />
        </section>

        {/* Connection Info */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Informacje o połączeniu
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Serwer</div>
              <div className="font-mono text-sm text-gray-900">
                {process.env.FITNET_DB_SERVER || '192.168.3.5\\fitnet2'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Baza danych</div>
              <div className="font-mono text-sm text-gray-900">
                {process.env.FITNET_DB_NAME || 'Fitnet'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Typ uwierzytelniania</div>
              <div className="font-mono text-sm text-gray-900">
                {process.env.FITNET_DB_USE_WINDOWS_AUTH === 'true'
                  ? 'Windows Authentication'
                  : 'SQL Server Authentication'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Tryb</div>
              <div className="font-mono text-sm text-gray-900">Read-only (tylko SELECT)</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Wskazówka:</strong> Jeśli pracujesz na testowej bazie (
              <code className="bg-blue-100 px-1 py-0.5 rounded">Fitnet_Test</code>),
              możesz bezpiecznie eksperymentować. Produkcyjna baza jest chroniona przed
              przypadkowymi modyfikacjami.
            </p>
          </div>
        </section>

        {/* Backup Instructions */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Instrukcje backupu
            </h2>
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 mb-4">
              Aby stworzyć backup bazy Fitnet i pracować na bezpiecznej kopii testowej:
            </p>

            <ol className="space-y-3 text-gray-700">
              <li>
                <strong>Sprawdź obciążenie</strong> (powyżej) - upewnij się że widzisz
                zielony komunikat ✅
              </li>
              <li>
                <strong>Uruchom skrypt backupu</strong> na serwerze:
                <pre className="bg-gray-900 text-gray-100 p-3 rounded mt-2 overflow-x-auto">
                  ./scripts/backup-fitnet-db.sh
                </pre>
              </li>
              <li>
                <strong>Przywróć backup do testowej bazy:</strong>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded mt-2 overflow-x-auto">
                  ./scripts/restore-fitnet-backup.sh
                </pre>
              </li>
              <li>
                <strong>Skonfiguruj K8s</strong> aby wskazywał na{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">Fitnet_Test</code>
              </li>
              <li>
                <strong>Pracuj bezpiecznie</strong> na kopii - produkcja nietknięta!
              </li>
            </ol>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium mb-2">
                ✅ Dlaczego jest to bezpieczne?
              </p>
              <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                <li>Backup używa COPY_ONLY - nie wpływa na produkcyjne backupy</li>
                <li>Wszystkie zapytania są read-only (blokowane INSERT/UPDATE/DELETE)</li>
                <li>Pracujesz na kopii Fitnet_Test, nie na produkcji</li>
                <li>Możesz łatwo przełączyć się z powrotem na produkcję</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Documentation Links */}
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Dokumentacja</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/docs/FITNET-QUICKSTART.md"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Quick Start</h3>
              <p className="text-sm text-gray-600">
                Szybki przewodnik integracji Fitnet (5 kroków)
              </p>
            </a>

            <a
              href="/docs/FITNET-BACKUP-SAFETY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Bezpieczeństwo backupu</h3>
              <p className="text-sm text-gray-600">
                Analiza bezpieczeństwa i najlepsze praktyki
              </p>
            </a>

            <a
              href="/docs/FITNET-INTEGRATION-GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Pełna dokumentacja</h3>
              <p className="text-sm text-gray-600">
                Kompletny przewodnik integracji z Fitnet
              </p>
            </a>

            <a
              href="/scripts/FITNET-SCRIPTS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Dokumentacja skryptów</h3>
              <p className="text-sm text-gray-600">
                Opis wszystkich dostępnych skryptów
              </p>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
