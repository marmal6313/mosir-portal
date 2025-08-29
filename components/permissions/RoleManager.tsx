import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Shield
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Role = Database['public']['Tables']['roles']['Row']
type RoleInsert = Database['public']['Tables']['roles']['Insert']


export function RoleManager() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [newRole, setNewRole] = useState<Partial<RoleInsert>>({
    name: '',
    display_name: '',
    description: '',
    color: '#6B7280',
    permissions: []
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) throw error
      setRoles(data || [])
    } catch (error) {
      console.error('Błąd podczas ładowania ról:', error)
      setMessage({ type: 'error', text: 'Błąd podczas ładowania ról' })
    } finally {
      setLoading(false)
    }
  }

  const createRole = async () => {
    try {
      if (!newRole.name || !newRole.display_name) {
        setMessage({ type: 'error', text: 'Nazwa i wyświetlana nazwa są wymagane' })
        return
      }

      setLoading(true)
      const { error } = await supabase
        .from('roles')
        .insert([{
          name: newRole.name!,
          display_name: newRole.display_name!,
          description: newRole.description || null,
          color: newRole.color || '#6B7280',
          permissions: newRole.permissions || []
        }])

      if (error) throw error

      setMessage({ type: 'success', text: 'Rola została utworzona pomyślnie!' })
      setNewRole({
        name: '',
        display_name: '',
        description: '',
        color: '#6B7280',
        permissions: []
      })
      await loadRoles()
    } catch (error) {
      console.error('Błąd podczas tworzenia roli:', error)
      setMessage({ type: 'error', text: 'Błąd podczas tworzenia roli' })
    } finally {
      setLoading(false)
    }
  }

  const updateRole = async () => {
    try {
      if (!editingRole) return

      setLoading(true)
      const { error } = await supabase
        .from('roles')
        .update({
          name: editingRole.name,
          display_name: editingRole.display_name,
          description: editingRole.description,
          color: editingRole.color,
          permissions: editingRole.permissions,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingRole.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Rola została zaktualizowana pomyślnie!' })
      setEditingRole(null)
      await loadRoles()
    } catch (error) {
      console.error('Błąd podczas aktualizacji roli:', error)
      setMessage({ type: 'error', text: 'Błąd podczas aktualizacji roli' })
    } finally {
      setLoading(false)
    }
  }

  const deleteRole = async (roleId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę rolę?')) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Rola została usunięta pomyślnie!' })
      await loadRoles()
    } catch (error) {
      console.error('Błąd podczas usuwania roli:', error)
      setMessage({ type: 'error', text: 'Błąd podczas usuwania roli' })
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (role: Role) => {
    setEditingRole({ ...role })
  }

  const cancelEditing = () => {
    setEditingRole(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Zarządzanie rolami
          </CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`mb-4 p-3 rounded-md ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {/* Formularz nowej roli */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-medium">Dodaj nową rolę</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-name">Nazwa (identyfikator)</Label>
                <Input
                  id="new-name"
                  value={newRole.name || ''}
                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="np. moderator"
                />
              </div>
              <div>
                <Label htmlFor="new-display-name">Wyświetlana nazwa</Label>
                <Input
                  id="new-display-name"
                  value={newRole.display_name || ''}
                  onChange={(e) => setNewRole(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="np. Moderator"
                />
              </div>
              <div>
                <Label htmlFor="new-color">Kolor</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="new-color"
                    type="color"
                    value={newRole.color || '#6B7280'}
                    onChange={(e) => setNewRole(prev => ({ ...prev, color: e.target.value }))}
                    className="w-16 h-10"
                  />
                  <Input
                    value={newRole.color || '#6B7280'}
                    onChange={(e) => setNewRole(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="#6B7280"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="new-description">Opis</Label>
                <Textarea
                  id="new-description"
                  value={newRole.description || ''}
                  onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Opis roli..."
                />
              </div>
            </div>
            <Button onClick={createRole} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj rolę
            </Button>
          </div>

          {/* Lista ról */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Istniejące role</h3>
            {roles.map((role) => (
              <Card key={role.id}>
                <CardContent className="p-4">
                  {editingRole?.id === role.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`edit-name-${role.id}`}>Nazwa</Label>
                          <Input
                            id={`edit-name-${role.id}`}
                            value={editingRole.name}
                            onChange={(e) => setEditingRole(prev => prev ? { ...prev, name: e.target.value } : null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-display-name-${role.id}`}>Wyświetlana nazwa</Label>
                          <Input
                            id={`edit-display-name-${role.id}`}
                            value={editingRole.display_name}
                            onChange={(e) => setEditingRole(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-color-${role.id}`}>Kolor</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`edit-color-${role.id}`}
                              type="color"
                              value={editingRole.color || '#6B7280'}
                              onChange={(e) => setEditingRole(prev => prev ? { ...prev, color: e.target.value } : null)}
                              className="w-16 h-10"
                            />
                            <Input
                              value={editingRole.color || '#6B7280'}
                              onChange={(e) => setEditingRole(prev => prev ? { ...prev, color: e.target.value } : null)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`edit-description-${role.id}`}>Opis</Label>
                          <Textarea
                            id={`edit-description-${role.id}`}
                            value={editingRole.description || ''}
                            onChange={(e) => setEditingRole(prev => prev ? { ...prev, description: e.target.value } : null)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={updateRole} disabled={loading}>
                          <Save className="h-4 w-4 mr-2" />
                          Zapisz
                        </Button>
                        <Button variant="outline" onClick={cancelEditing}>
                          <X className="h-4 w-4 mr-2" />
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: role.color || '#6B7280' }}
                        />
                        <div>
                          <div className="font-medium">{role.display_name}</div>
                          <div className="text-sm text-gray-500">@{role.name}</div>
                          {role.description && (
                            <div className="text-sm text-gray-600">{role.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(role)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edytuj
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteRole(role.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Usuń
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
