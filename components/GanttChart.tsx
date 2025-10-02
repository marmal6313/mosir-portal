'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

export interface GanttItem {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  progress: number; // Procent ukończenia (0-100)
  status: 'new' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  assigneeId?: string | null;
  description?: string;
  department?: string;
  department_id?: number;
}

interface GanttChartProps {
  items: GanttItem[];
  range?: { start: Date; end: Date }; // Nowy prop do kontroli zakresu osi
  onBarClick?: (item: GanttItem) => void;
  onItemUpdate?: (item: GanttItem) => void;
  onItemDelete?: (item: GanttItem) => void;
  canDelete?: boolean; // Nowy prop do kontroli uprawnień usuwania
}

interface User {
  id: string;
  full_name: string;
  email: string;
  department_id: number;
}

const statusLabel = (status: GanttItem['status']) => {
  switch (status) {
    case 'new': return 'Nowe';
    case 'in_progress': return 'W trakcie';
    case 'completed': return 'Zakończone';
    case 'cancelled': return 'Anulowane';
    default: return status;
  }
};

const priorityLabel = (priority: GanttItem['priority']) => {
  switch (priority) {
    case 'low': return 'Niskie';
    case 'medium': return 'Średnie';
    case 'high': return 'Wysokie';
    default: return priority;
  }
};

const priorityClass = (priority: GanttItem['priority']) => {
  switch (priority) {
    case 'low': return 'bg-blue-500';
    case 'medium': return 'bg-yellow-500';
    case 'high': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const statusClass = (status: GanttItem['status']) => {
  switch (status) {
    case 'new': return 'bg-gray-400';
    case 'in_progress': return 'bg-blue-400';
    case 'completed': return 'bg-green-400';
    case 'cancelled': return 'bg-red-400';
    default: return 'bg-gray-400';
  }
};

const getStatusColor = (status: GanttItem['status']) => {
  switch (status) {
    case 'new': return '#6b7280';
    case 'in_progress': return '#3b82f6';
    case 'completed': return '#10b981';
    case 'cancelled': return '#ef4444';
    default: return '#6b7280';
  }
};

const getPriorityColor = (priority: GanttItem['priority']) => {
  switch (priority) {
    case 'low': return '#10b981';
    case 'medium': return '#f59e0b';
    case 'high': return '#ef4444';
    default: return '#6b7280';
  }
};

export const GanttChart: React.FC<GanttChartProps> = ({ items = [], range, onBarClick, onItemUpdate, onItemDelete, canDelete = false }) => {
  // ===== Nowe helpery dla liniowej osi =====
  const DAY = 24 * 60 * 60 * 1000;
  const atMidnight = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const clamp = (d: Date, min: Date, max: Date) =>
    new Date(Math.min(Math.max(d.getTime(), min.getTime()), max.getTime()));
  const diffDays = (a: Date, b: Date) =>
    Math.floor((atMidnight(b).getTime() - atMidnight(a).getTime()) / DAY);

  // Budujemy liniową siatkę dni: start..end (inclusive)
  function buildGrid(rangeStart: Date, rangeEnd: Date) {
    const start = atMidnight(rangeStart);
    const end   = atMidnight(rangeEnd); // inclusive
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d));
    return { days, start, end, totalDays: days.length };
  }

  // Oblicz pozycję paska w kolumnach grida (start 1-based, inclusive span)
  function computeColPlacement(rangeStart: Date, rangeEnd: Date, itemStart: Date, itemEnd: Date) {
    const gridStart = atMidnight(rangeStart);
    const gridEnd   = atMidnight(rangeEnd);
    const s = atMidnight(clamp(itemStart, gridStart, gridEnd));
    const e = atMidnight(clamp(itemEnd,   gridStart, gridEnd));
    const startCol = diffDays(gridStart, s) + 1;
    const span     = Math.max(1, diffDays(s, e) + 1);
    return { startCol, span };
  }

  const [selectedItem, setSelectedItem] = useState<GanttItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{ item: GanttItem; x: number; y: number } | null>(null);
  const [tempProgress, setTempProgress] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Normalizuj datę do północy w lokalnej strefie czasowej
  const normalizeDate = (date: Date) => {
    // Użyj lokalnej strefy czasowej
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return new Date(year, month, day, 0, 0, 0, 0);
  };
  
  // TYMCZASOWE: Użyj 2024 zamiast 2025 (bo dane w bazie są błędne)
  const currentDate = new Date();
  const fixedDate = new Date(2024, currentDate.getMonth(), currentDate.getDate());
  const today = normalizeDate(fixedDate);
  
  console.log('🔍 Rzeczywista data:', new Date().toISOString());
  console.log('🔍 Używana data (2024):', today.toISOString());
  
  // Domyślny widok: 1 tydzień wstecz + 1 tydzień w przód od dzisiaj
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 7);
  
  const defaultEndDate = new Date(today);
  defaultEndDate.setDate(today.getDate() + 14);
  
  // Użyj przekazanego zakresu lub oblicz z danych
  let minDate: Date;
  let maxDate: Date;
  
  if (range) {
    // Użyj przekazanego zakresu (z page.tsx)
    minDate = range.start;
    maxDate = range.end;
  } else if (items.length === 0) {
    // Brak zadań i brak zakresu - użyj domyślnego
    minDate = defaultStartDate;
    maxDate = defaultEndDate;
  } else {
    // Znajdź rzeczywisty zakres zadań
    const actualMinDate = new Date(Math.min(...items.map(item => item.startDate.getTime())));
    const actualMaxDate = new Date(Math.max(...items.map(item => item.endDate.getTime())));
    
    // Użyj szerszego zakresu: rzeczywisty zakres lub domyślny
    minDate = new Date(Math.min(actualMinDate.getTime(), defaultStartDate.getTime()));
    maxDate = new Date(Math.max(actualMaxDate.getTime(), defaultEndDate.getTime()));
  }
  
  // ===== Nowa logika: buduj liniową siatkę dni =====
  const dataMin = items.length ? new Date(Math.min(...items.map(i => atMidnight(i.startDate).getTime()))) : new Date();
  const dataMax = items.length ? new Date(Math.max(...items.map(i => atMidnight(i.endDate).getTime())))   : new Date();
  const gridStart = range ? atMidnight(range.start) : dataMin;
  const gridEnd   = range ? atMidnight(range.end)   : dataMax;

  const { days, totalDays } = buildGrid(gridStart, gridEnd);
  
  // Debug informacje o datach (tylko pierwszy raz)
  if (!(globalThis as {ganttDateDebugDone?: boolean}).ganttDateDebugDone) {
    (globalThis as {ganttDateDebugDone?: boolean}).ganttDateDebugDone = true;
    console.log('🔍 GanttChart zakres dat:');
    console.log('  today:', today.toISOString());
    console.log('  minDate:', minDate.toISOString());
    console.log('  maxDate:', maxDate.toISOString());
    console.log('  totalDays:', totalDays);
    console.log('  itemsCount:', items.length);
  }
  
  // ===== Stara funkcja getDayOffset usunięta - teraz używamy CSS Grid placement =====
  
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  };
  
  // ===== Stare funkcje usunięte - teraz używamy CSS Grid placement =====

  const handleBarClick = (item: GanttItem) => {
    if (onBarClick) {
      onBarClick(item);
      return;
    }

    if (selectedItem?.id === item.id) {
      // Jeśli klikamy na to samo zadanie, zamknij modal
      handleCloseDetails();
    } else {
      // Otwórz modal z nowym zadaniem - zawsze z aktualnymi danymi z bazy
      setSelectedItem({ ...item });
      setTempProgress(null);
    }
  };

  const handleCloseDetails = () => {
    // Sprawdź czy były wprowadzone zmiany
    if (hasUnsavedChanges()) {
      if (window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz zamknąć bez zapisywania?')) {
        // Resetuj zmiany i zamknij
        setSelectedItem(null);
        setTempProgress(null);
      } else {
        // Użytkownik anulował zamknięcie
        return;
      }
    } else {
      // Brak zmian - zamknij normalnie
      setSelectedItem(null);
      setTempProgress(null);
    }
  };

  const handleStatusChange = (newStatus: GanttItem['status']) => {
    if (selectedItem) {
      setSelectedItem({
        ...selectedItem,
        status: newStatus
      });
    }
  };

  const handlePriorityChange = (newPriority: GanttItem['priority']) => {
    if (selectedItem) {
      setSelectedItem({
        ...selectedItem,
        priority: newPriority
      });
    }
  };

  const handleAssigneeChange = (newAssignee: string) => {
    if (selectedItem) {
      setSelectedItem({
        ...selectedItem,
        assignee: newAssignee
      });
    }
  };

  const handleMouseEnter = (item: GanttItem, event: React.MouseEvent) => {
    setHoveredItem(item.id);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipData({
      item,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setTooltipData(null);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseInt(e.target.value);
    setTempProgress(newProgress);
    
    // Aktualizuj selectedItem w czasie rzeczywistym (tylko lokalnie)
    if (selectedItem) {
      setSelectedItem({
        ...selectedItem,
        progress: newProgress
      });
    }
  };

  const handleProgressMouseUp = () => {
    // Nie robimy nic - zmiany są tylko lokalne
    // setTempProgress(null); // Usuwamy to, żeby zachować wartość do zapisania
  };

  const handleSaveChanges = () => {
    if (selectedItem && onItemUpdate) {
      // Sprawdź czy są rzeczywiste zmiany
      const originalItem = items.find(item => item.id === selectedItem.id);
      if (originalItem && hasUnsavedChanges()) {
        onItemUpdate(selectedItem);
        handleCloseDetails();
      }
    }
  };

  const hasUnsavedChanges = () => {
    if (!selectedItem) return false;
    const originalItem = items.find(item => item.id === selectedItem.id);
    if (!originalItem) return false;
    
    return (
      selectedItem.progress !== originalItem.progress ||
      selectedItem.status !== originalItem.status ||
      selectedItem.priority !== originalItem.priority ||
      selectedItem.assignee !== originalItem.assignee ||
      selectedItem.description !== originalItem.description
    );
  };

  const handleDeleteTask = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTask = () => {
    if (selectedItem && onItemDelete) {
      onItemDelete(selectedItem);
      setShowDeleteConfirm(false);
      setSelectedItem(null);
      setTempProgress(null);
    }
  };

  const cancelDeleteTask = () => {
    setShowDeleteConfirm(false);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
                 const { data, error } = await supabase
           .from('users_with_details')
           .select('id, full_name, email, department_id');

        if (error) {
          throw error;
        }
        setUsers(data as User[]);
      } catch (err) {
        setErrorUsers('Failed to fetch users');
        console.error(err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        .slider::-moz-range-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .slider:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }
      `}</style>
      {/* Header - grid z kolumnami dni */}
      <div className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
        {/* Informacja o zakresie dat */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-center">
          <span className="text-sm font-medium text-blue-800">
            📅 Widok: {formatDate(minDate)} - {formatDate(maxDate)} 
            <span className="ml-2 text-blue-600">
              (Dzisiaj: {formatDate(today)})
            </span>
          </span>
        </div>
        
        {/* NAGŁÓWEK – ta sama liczba kolumn co wiersze */}
        <div className="grid border-b border-gray-200 gap-0"
             style={{ gridTemplateColumns: `240px repeat(${totalDays}, minmax(28px,1fr))` }}>
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold border-r border-gray-200">Zadanie</div>
          {days.map(d => (
            <div key={+d} className="px-2 py-2 text-center text-xs text-gray-600 border-r border-gray-100">
              {d.toLocaleDateString('pl-PL', { day: '2-digit' })}.
              {d.toLocaleDateString('pl-PL', { month: '2-digit' })}
            </div>
          ))}
        </div>
      </div>

      {/* WIERSZE - grid z kolumnami dni */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {items.map((item) => {
            const { startCol, span } = computeColPlacement(gridStart, gridEnd, item.startDate, item.endDate);
            
            return (
              <div 
                key={item.id} 
                className={`grid items-center gap-0 border-b border-gray-100 transition-all duration-200 cursor-pointer ${
                  hoveredItem === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                } ${selectedItem?.id === item.id ? 'bg-blue-100' : ''}`}
                style={{ gridTemplateColumns: `240px repeat(${totalDays}, minmax(28px,1fr))` }}
                role="button"
                tabIndex={0}
                onClick={() => handleBarClick(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleBarClick(item);
                  }
                }}
              >
                {/* kolumna opisowa */}
                <div className="px-3 py-3 border-r border-gray-100">
                  <div className="text-sm font-medium text-gray-900 mb-1 truncate" title={item.title}>
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`inline-block w-3 h-3 rounded-full ${statusClass(item.status)}`}></span>
                    <span>{statusLabel(item.status)}</span>
                    <span className="text-gray-400">•</span>
                    <span className={`inline-block w-3 h-3 rounded-full ${priorityClass(item.priority)}`}></span>
                    <span>{priorityLabel(item.priority)}</span>
                  </div>
                  {item.assignee && (
                    <div className="text-xs text-gray-500 mt-1 truncate" title={item.assignee}>
                      Przypisane: {item.assignee}
                    </div>
                  )}
                </div>

                {/* siatka dni w wierszu (opcjonalny „podział" tła) */}
                {days.map(d => <div key={`${item.id}-${+d}`} className="h-10 border-r border-gray-50" />)}

                {/* pasek – USTAWIONY KOLUMNAMI, nie procentami */}
                <div
                  className={`h-3 rounded-full bg-blue-500/90 hover:bg-blue-600 -mt-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${item.status === 'completed' ? 'opacity-80' : 'opacity-95'}`}
                  style={{ 
                    gridColumn: `${1 + startCol} / span ${span}`,  // +1 bo kolumna 1 to „Zadanie"
                    backgroundColor: getStatusColor(item.status)
                  }}
                  onMouseEnter={(e) => handleMouseEnter(item, e)}
                  onMouseLeave={handleMouseLeave}
                  title={`${item.title} (${formatDate(item.startDate)} - ${formatDate(item.endDate)}) - ${item.progress}%`}
                >
                  {/* Progress overlay */}
                  <div className="h-full bg-white/30 rounded-l" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <div 
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 max-w-xs"
          style={{
            left: tooltipData.x,
            top: tooltipData.y,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="font-medium mb-2">{tooltipData.item.title}</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${statusClass(tooltipData.item.status)}`}></span>
              <span>Status: {statusLabel(tooltipData.item.status)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${priorityClass(tooltipData.item.priority)}`}></span>
              <span>Priorytet: {priorityLabel(tooltipData.item.priority)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${tooltipData.item.progress}%` }}
                ></div>
              </div>
              <span>Postęp: {tooltipData.item.progress}%</span>
            </div>
            {tooltipData.item.assignee && (
              <div>Przypisane: {tooltipData.item.assignee}</div>
            )}
            <div>Okres: {formatDate(tooltipData.item.startDate)} - {formatDate(tooltipData.item.endDate)}</div>
          </div>
          <div className="text-xs text-gray-300 mt-2">Kliknij aby zobaczyć szczegóły</div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedItem.title}</h2>
                  {hasUnsavedChanges() && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      Niezapisane zmiany
                    </Badge>
                  )}
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={selectedItem.status}
                      onChange={(e) => handleStatusChange(e.target.value as GanttItem['status'])}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="new">Nowe</option>
                      <option value="in_progress">W trakcie</option>
                      <option value="completed">Zakończone</option>
                      <option value="cancelled">Anulowane</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priorytet</label>
                    <select
                      value={selectedItem.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as GanttItem['priority'])}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="low">Niskie</option>
                      <option value="medium">Średnie</option>
                      <option value="high">Wysokie</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Postęp (%)</label>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={tempProgress !== null ? tempProgress : selectedItem.progress}
                        onChange={handleProgressChange}
                        onMouseUp={handleProgressMouseUp}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${tempProgress !== null ? tempProgress : selectedItem.progress}%, #e5e7eb ${tempProgress !== null ? tempProgress : selectedItem.progress}%, #e5e7eb 100%)`
                        }}
                      />
                      {/* Wizualny wskaźnik postępu */}
                      <div className="mt-2 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-200 ease-out rounded-full"
                          style={{ width: `${tempProgress !== null ? tempProgress : selectedItem.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2 font-medium text-center">
                      {tempProgress !== null ? tempProgress : selectedItem.progress}%
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Przypisane do</label>
                    <select
                      value={selectedItem.assignee || ''}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Wybierz osobę</option>
                                             {loadingUsers ? (
                         <option value="">Ładowanie użytkowników...</option>
                       ) : errorUsers ? (
                         <option value="">Błąd: {errorUsers}</option>
                       ) : users.filter(user => !selectedItem.department_id || user.department_id === selectedItem.department_id).length === 0 ? (
                         <option value="">Brak użytkowników w tym dziale</option>
                       ) : (
                         users
                           .filter(user => !selectedItem.department_id || user.department_id === selectedItem.department_id)
                           .map(user => (
                             <option key={user.id} value={user.full_name}>
                               {user.full_name} {user.email ? `(${user.email})` : ''}
                             </option>
                           ))
                       )}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dział</label>
                    <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                      {selectedItem.department || 'Nie określono'}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Okres</label>
                    <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                      {formatDate(selectedItem.startDate)} - {formatDate(selectedItem.endDate)}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Opis</label>
                    <textarea
                      value={selectedItem.description || ''}
                      onChange={(e) => {
                        if (selectedItem) {
                          setSelectedItem({
                            ...selectedItem,
                            description: e.target.value
                          });
                        }
                      }}
                      placeholder="Wprowadź opis zadania"
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center">
                {/* Przycisk usuwania po lewej - tylko jeśli użytkownik ma uprawnienia */}
                {canDelete && onItemDelete ? (
                  <button
                    onClick={handleDeleteTask}
                    className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Usuń zadanie
                  </button>
                ) : (
                  <div></div> /* Puste miejsce dla wyrównania */
                )}
                
                {/* Przyciski akcji po prawej */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseDetails}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Zamknij
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={!hasUnsavedChanges()}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      hasUnsavedChanges()
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {hasUnsavedChanges() ? 'Zapisz zmiany' : 'Brak zmian'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia usunięcia */}
      {showDeleteConfirm && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Potwierdzenie usunięcia
                  </h3>
                  <p className="text-sm text-gray-600">
                    Ta akcja jest nieodwracalna
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Czy na pewno chcesz usunąć zadanie:
                </p>
                <div className="bg-gray-50 p-3 rounded-md border-l-4 border-red-500">
                  <div className="font-semibold text-gray-900">{selectedItem.title}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Status: {statusLabel(selectedItem.status)} • 
                    Priorytet: {priorityLabel(selectedItem.priority)}
                  </div>
                  {selectedItem.assignee && (
                    <div className="text-sm text-gray-600">
                      Przypisane: {selectedItem.assignee}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDeleteTask}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={confirmDeleteTask}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Usuń zadanie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
