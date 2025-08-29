import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Shield, 
  Users, 
  Settings, 
  FileText, 
  BarChart3,
  Eye,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { RoleManager } from './RoleManager'
import { PermissionManager } from './PermissionManager'
import { ScopeManager } from './ScopeManager'
import { PermissionDisplay } from './PermissionDisplay'

type TabType = 'overview' | 'roles' | 'permissions' | 'scopes' | 'user-permissions'

const TABS = [
  { id: 'overview', label: 'Przegląd', icon: Eye, description: 'Ogólny widok systemu uprawnień' },
  { id: 'roles', label: 'Role', icon: Users, description: 'Zarządzanie rolami użytkowników' },
  { id: 'permissions', label: 'Uprawnienia', icon: Shield, description: 'Konfiguracja uprawnień dla ról' },
  { id: 'scopes', label: 'Scope\'y', icon: Settings, description: 'Zarządzanie poziomami dostępu' },
  { id: 'user-permissions', label: 'Moje uprawnienia', icon: CheckCircle, description: 'Twoje aktualne uprawnienia' }
]

export function PermissionsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <PermissionsOverview />
      case 'roles':
        return <RoleManager />
      case 'permissions':
        return <PermissionManager />
      case 'scopes':
        return <ScopeManager />
      case 'user-permissions':
        return <PermissionDisplay />
      default:
        return <PermissionsOverview />
    }
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8" />
          <h1 className="text-2xl font-bold">System Zarządzania Uprawnieniami</h1>
        </div>
        <p className="text-blue-100">
          Zaawansowane zarządzanie rolami, uprawnieniami i poziomami dostępu w systemie
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Opis aktywnej zakładki */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          {(() => {
            const Icon = TABS.find(tab => tab.id === activeTab)?.icon || Eye
            return <Icon className="h-5 w-5 text-blue-600" />
          })()}
          <div>
            <h3 className="font-medium text-gray-900">
              {TABS.find(tab => tab.id === activeTab)?.label}
            </h3>
            <p className="text-sm text-gray-600">
              {TABS.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Zawartość zakładki */}
      {renderTabContent()}
    </div>
  )
}

function PermissionsOverview() {
  const stats = [
    { label: 'Role w systemie', value: '4', icon: Users, color: 'text-blue-600' },
    { label: 'Uprawnienia', value: '25', icon: Shield, color: 'text-green-600' },
    { label: 'Zasoby', value: '5', icon: FileText, color: 'text-purple-600' },
    { label: 'Poziomy dostępu', value: '4', icon: Settings, color: 'text-orange-600' }
  ]

  const features = [
    {
      title: 'Zarządzanie rolami',
      description: 'Twórz, edytuj i usuwaj role użytkowników z pełną kontrolą nad uprawnieniami',
      icon: Users,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Konfiguracja uprawnień',
      description: 'Przypisuj szczegółowe uprawnienia do ról za pomocą intuicyjnej macierzy',
      icon: Shield,
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'Zarządzanie scope\'ami',
      description: 'Kontroluj poziomy dostępu: globalny, działowy, własny lub brak',
      icon: Settings,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Monitorowanie uprawnień',
      description: 'Śledź i analizuj uprawnienia użytkowników w czasie rzeczywistym',
      icon: BarChart3,
      color: 'bg-orange-100 text-orange-600'
    }
  ]

  const bestPractices = [
    'Zasada najmniejszych uprawnień - przyznawaj tylko niezbędne uprawnienia',
    'Regularne przeglądy uprawnień - sprawdzaj i aktualizuj co miesiąc',
    'Separacja obowiązków - nie łącz funkcji administratora i użytkownika',
    'Audyt uprawnień - prowadź logi wszystkich zmian w uprawnieniach',
    'Szkolenia użytkowników - edukuj o bezpieczeństwie i uprawnieniach'
  ]

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Funkcjonalności */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${feature.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Najlepsze praktyki */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Najlepsze praktyki bezpieczeństwa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bestPractices.map((practice, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">{practice}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Informacje o systemie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Ważne informacje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• Zmiany w uprawnieniach są natychmiastowe</p>
              <p>• Domyślne role nie mogą być usunięte</p>
              <p>• Scope&apos;y określają poziom dostępu do zasobów</p>
              <p>• Wszystkie zmiany są logowane w systemie</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Wsparcie techniczne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• Dokumentacja systemu uprawnień</p>
              <p>• Szkolenia dla administratorów</p>
              <p>• Wsparcie w konfiguracji</p>
              <p>• Regularne aktualizacje bezpieczeństwa</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


