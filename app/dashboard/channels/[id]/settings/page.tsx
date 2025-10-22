'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, ArrowLeft, UserPlus, Trash2 } from 'lucide-react'

import type { Database } from '@/types/database'

type ChannelRow = Database['public']['Tables']['communication_channels']['Row']

type ChannelDepartment = {
  department_id: number | null
}

type ChannelMemberRow = {
  user_id: string | null
  added_at: string | null
  added_by: string | null
  member?: UserWithDetails | null
}

type ChannelDetails = ChannelRow & {
  channel_departments: ChannelDepartment[]
  channel_members: ChannelMemberRow[]
}

type UserWithDetails = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department_name: string | null
  role: string | null
  active?: boolean | null
}

export default function ChannelSettingsPage() {
  const params = useParams<{ id: string }>()
  const channelId = params?.id
  const router = useRouter()
  const { user, profile } = useAuthContext()

  const [channel, setChannel] = useState<ChannelDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<UserWithDetails[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [departmentUserIds, setDepartmentUserIds] = useState<Set<string>>(new Set())

  const canManage = useMemo(() => {
    if (!user || !channel) return false
    if (channel.created_by === user.id) return true
    if (profile?.role === 'superadmin' || profile?.role === 'dyrektor') return true
    return false
  }, [channel, profile?.role, user])

  const enrichManualMembers = useCallback(async (channel: ChannelDetails) => {
    const manualIds = (channel.channel_members ?? [])
      .map((member) => member.user_id)
      .filter((id): id is string => Boolean(id))

    if (!manualIds.length) {
      return channel
    }

    const { data, error } = await supabase
      .from('users_with_details')
      .select('id, full_name, first_name, last_name, department_name, role, active')
      .in('id', manualIds)

    if (error) {
      console.error('Nie udało się wczytać szczegółów członków kanału', error)
      return channel
    }

    const activeUsers = new Map(
      (data ?? [])
        .filter((item) => (item.active ?? true) && item.id)
        .map((item) => [item.id!, item])
    )

    return {
      ...channel,
      channel_members: (channel.channel_members ?? []).map((member) => ({
        ...member,
        member: member.user_id ? activeUsers.get(member.user_id) ?? null : null,
      })),
    }
  }, [])

  const loadChannel = useCallback(async () => {
    if (!channelId || !user) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('communication_channels')
        .select(`
          id,
          name,
          description,
          visibility,
          created_by,
          channel_departments ( department_id ),
          channel_members (
            user_id,
            added_at,
            added_by
          )
        `)
        .eq('id', channelId)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        setError('Nie znaleziono kanału')
        return
      }

      const enriched = await enrichManualMembers(data as ChannelDetails)
      setChannel(enriched)
    } catch (err) {
      console.error('Nie udało się wczytać kanału', err)
      setError('Nie udało się wczytać danych kanału. Spróbuj ponownie później.')
    } finally {
      setLoading(false)
    }
  }, [channelId, user, enrichManualMembers])

  useEffect(() => {
    if (!user || !channelId) return
    loadChannel()
  }, [user, channelId, loadChannel])

  useEffect(() => {
    if (!channel || channel.visibility !== 'restricted') {
      setDepartmentUserIds(new Set())
      return
    }

    const departmentIds = (channel.channel_departments ?? [])
      .map((dept) => dept.department_id)
      .filter((id): id is number => typeof id === 'number')

    if (!departmentIds.length) {
      setDepartmentUserIds(new Set())
      return
    }

    const loadDepartmentMembers = async () => {
      const { data, error } = await supabase
        .from('users_with_details')
        .select('id')
        .in('department_id', departmentIds)
        .eq('active', true)

      if (error) {
        console.error('Nie udało się wczytać członków działu', error)
        setDepartmentUserIds(new Set())
        return
      }

      const ids = new Set<string>((data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))
      setDepartmentUserIds(ids)
    }

    loadDepartmentMembers()
  }, [channel])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    const query = searchTerm.trim()
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true)
        const escaped = query.replace(/[%_]/g, '')
        const { data, error } = await supabase
          .from('users_with_details')
          .select('id, full_name, first_name, last_name, department_name, role, active')
          .or(`full_name.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`)
          .eq('active', true)
          .limit(10)

        if (error) throw error

        const manualMemberIds = new Set(
          (channel?.channel_members ?? [])
            .map((member) => member.user_id)
            .filter((id): id is string => Boolean(id))
        )

        const excluded = new Set<string>([
          ...(departmentUserIds ?? new Set<string>()),
          ...(manualMemberIds ?? new Set<string>()),
          channel?.created_by ?? '',
          user?.id ?? '',
        ])

        const filtered = (data ?? [])
          .filter((item): item is UserWithDetails => Boolean(item.id))
          .filter((item) => !excluded.has(item.id!))

        setSearchResults(filtered)
      } catch (error) {
        console.error('Nie udało się wyszukać użytkowników', error)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, channel, departmentUserIds, user?.id])

  const handleAddMember = useCallback(
    async (userId: string) => {
      if (!channelId) return
      setSaving(true)
      try {
        const { error } = await supabase.rpc('add_channel_member', {
          p_channel_id: channelId,
          p_user_id: userId,
        })

        if (error) throw error

        setSearchTerm('')
        setSearchResults([])
        await loadChannel()
      } catch (error) {
        console.error('Nie udało się dodać użytkownika do kanału', error)
        setError('Nie udało się dodać użytkownika. Spróbuj ponownie później.')
      } finally {
        setSaving(false)
      }
    },
    [channelId, loadChannel]
  )

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!channelId) return
      setSaving(true)
      try {
        const { error } = await supabase.rpc('remove_channel_member', {
          p_channel_id: channelId,
          p_user_id: userId,
        })

        if (error) throw error

        await loadChannel()
      } catch (error) {
        console.error('Nie udało się usunąć użytkownika z kanału', error)
        setError('Nie udało się usunąć użytkownika. Spróbuj ponownie później.')
      } finally {
        setSaving(false)
      }
    },
    [channelId, loadChannel]
  )

  const manualMembers = useMemo(() => {
    return (channel?.channel_members ?? [])
      .map((member) => {
        const details = member.member
        return {
          user_id: member.user_id,
          added_at: member.added_at,
          added_by: member.added_by,
          displayName: details?.full_name || `${details?.first_name ?? ''} ${details?.last_name ?? ''}`.trim() || 'Użytkownik',
          department: details?.department_name,
          role: details?.role,
        }
      })
      .filter((member) => Boolean(member.user_id))
      .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
  }, [channel?.channel_members])

  if (!channelId) {
    return (
      <div className="p-6">
        <p>Brak identyfikatora kanału.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center gap-3 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" /> Wczytywanie ustawień kanału...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/channels')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do kanałów
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Błąd</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!channel) {
    return null
  }

  if (!canManage) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/channels')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do kanałów
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Brak uprawnień</CardTitle>
            <CardDescription>Nie możesz zarządzać tym kanałem.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => router.push('/dashboard/channels')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do kanałów
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ustawienia kanału</h1>
          <p className="text-sm text-gray-500">Zarządzaj dostępem i członkami kanału &quot;{channel.name}&quot;</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
          <CardDescription>Zarządzaj ręcznymi członkami kanału. Członkowie przypisanych działów mają dostęp automatycznie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Obecni członkowie</h2>
            {manualMembers.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Brak ręcznie dodanych użytkowników.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {manualMembers.map((member) => (
                  <li key={member.user_id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.displayName}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                        {member.department && <Badge variant="outline">{member.department}</Badge>}
                        {member.role && <Badge variant="outline">{member.role}</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => member.user_id && handleRemoveMember(member.user_id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Usuń
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700">Dodaj użytkownika</h2>
            <p className="text-xs text-gray-500">
              Wyszukaj użytkownika, którego chcesz dodać do kanału. Użytkownicy przypisani do działów kanału są pomijani.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Wpisz imię i nazwisko"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="sm:w-72"
              />
            </div>
            {searchLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Szukanie użytkowników...
              </div>
            ) : searchTerm && searchResults.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">Brak wyników spełniających kryteria.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {searchResults.map((result) => (
                  <li key={result.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{result.full_name || `${result.first_name ?? ''} ${result.last_name ?? ''}`.trim()}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                        {result.department_name && <Badge variant="outline">{result.department_name}</Badge>}
                        {result.role && <Badge variant="outline">{result.role}</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() => handleAddMember(result.id)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" /> Dodaj
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
