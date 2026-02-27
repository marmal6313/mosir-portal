'use client';

import { useState } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface LoadStatusData {
  activeConnections: number;
  databaseSizeMB: number;
  databaseSizeGB: number;
  estimatedBackupTime: string;
  diskSpace?: Array<{ drive: string; mb_free: number }>;
  longRunningQueries: number;
  recommendation: 'excellent' | 'good' | 'medium' | 'poor';
  recommendationText: string;
  canBackupNow: boolean;
  timestamp?: string;
  database?: string;
}

export default function FitnetLoadStatus() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoadStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkLoad = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fitnet/load');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nie udało się sprawdzić obciążenia');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'excellent':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'poor':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'excellent':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'good':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'medium':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'poor':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Obciążenie bazy Fitnet
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Sprawdź czy to dobry moment na backup produkcyjnej bazy
          </p>
        </div>
        <button
          onClick={checkLoad}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Sprawdzam...' : 'Sprawdź obciążenie'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Błąd</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Recommendation */}
          <div
            className={`p-4 border-2 rounded-lg ${getRecommendationColor(
              data.recommendation
            )}`}
          >
            <div className="flex items-start gap-3">
              {getRecommendationIcon(data.recommendation)}
              <div className="flex-1">
                <h4 className="font-semibold text-lg">Rekomendacja</h4>
                <p className="mt-2">{data.recommendationText}</p>
                {data.canBackupNow && (
                  <p className="mt-2 text-sm font-medium">
                    ✅ Możesz uruchomić backup teraz
                  </p>
                )}
                {!data.canBackupNow && (
                  <p className="mt-2 text-sm font-medium">
                    ❌ Zalecane odczekanie do wieczora (23:00-06:00) lub weekendu
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Connections */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Aktywne połączenia</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.activeConnections}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.activeConnections < 5
                  ? '✅ Bardzo mało'
                  : data.activeConnections < 20
                  ? '⚠️ Średnio'
                  : '❌ Dużo'}
              </div>
            </div>

            {/* Database Size */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Rozmiar bazy</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.databaseSizeGB.toFixed(2)} GB
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.databaseSizeMB.toLocaleString()} MB
              </div>
            </div>

            {/* Estimated Time */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Szacowany czas backupu</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.estimatedBackupTime}
              </div>
              <div className="text-xs text-gray-500 mt-1">Z kompresją</div>
            </div>

            {/* Long Running Queries */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Długie zapytania</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.longRunningQueries}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.longRunningQueries === 0 ? '✅ Brak' : '⚠️ Aktywne'}
              </div>
            </div>
          </div>

          {/* Disk Space */}
          {data.diskSpace && data.diskSpace.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">
                Wolne miejsce na dysku
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.diskSpace.map((disk) => (
                  <div
                    key={disk.drive}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <span className="font-medium">Dysk {disk.drive}:</span>
                    <span className="text-gray-700">
                      {(disk.mb_free / 1024).toFixed(1)} GB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-500 text-center">
            Baza: {data.database} • Sprawdzono:{' '}
            {data.timestamp
              ? new Date(data.timestamp).toLocaleString('pl-PL')
              : 'nieznany'}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!data && !error && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">
            Jak używać tego narzędzia?
          </h4>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Kliknij &quot;Sprawdź obciążenie&quot; aby sprawdzić aktualny stan bazy Fitnet</li>
            <li>
              Jeśli zobaczysz zielony komunikat (✅) - możesz uruchomić backup teraz
            </li>
            <li>
              Jeśli zobaczysz czerwony (❌) - poczekaj do wieczora (23:00-06:00) lub
              weekendu
            </li>
            <li>Backup używa COPY_ONLY i nie wpływa na produkcyjne backupy</li>
          </ol>
        </div>
      )}

      {/* Best Times Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">
          Najlepsze momenty na backup:
        </h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>🌙 <strong>Noc:</strong> 23:00 - 06:00 (MOSiR zamknięty)</li>
          <li>
            📅 <strong>Weekend:</strong> Sobota/Niedziela rano (minimalne użycie)
          </li>
          <li>
            ⏰ <strong>Po godzinach:</strong> Po zamknięciu MOSiR (sprawdź dokładnie
            kiedy)
          </li>
        </ul>
      </div>
    </div>
  );
}
