'use client'

import { useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { Bell, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

// Definicje typów
interface TaskPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: {
    id: string
    title: string
    status: string
  }
  old?: {
    id: string
    title: string
    status: string
  }
}

interface SupabaseRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, string | number | boolean | null>
  old?: Record<string, string | number | boolean | null>
}

interface NotificationFunctions {
  success: (title: string, message: string) => void
  error: (title: string, message: string) => void
  warning: (title: string, message: string) => void
  info: (title: string, message: string) => void
}

type ToastVariant = 'success' | 'warning' | 'info' | 'default' | 'destructive' | null | undefined

declare global {
  interface Window {
    showNotification: NotificationFunctions
  }
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  timestamp: string
  read: boolean
  action_url?: string
}

export function NotificationManager() {
  const { toast } = useToast()

  const showNotification = useCallback((notification: Notification) => {
    toast({
      title: notification.title,
      description: notification.message,
      variant: (notification.type === 'error' ? 'destructive' : notification.type) as ToastVariant,
      duration: 5000,
      action: notification.action_url ? (
        <button
          onClick={() => window.open(notification.action_url, '_blank')}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
        >
          Zobacz
        </button>
      ) : undefined,
    })
  }, [toast])

  const handleTaskNotification = useCallback((payload: SupabaseRealtimePayload) => {
    if (payload.eventType === 'INSERT') {
      const task = payload.new as { id: string; title: string; status: string }
      toast({
        title: 'Nowe zadanie',
        description: `Dodano nowe zadanie: ${task.title}`,
        variant: 'info',
        duration: 4000,
        action: (
          <button
            onClick={() => window.open(`/dashboard/tasks/${task.id}`, '_blank')}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
          >
            Zobacz zadanie
          </button>
        ),
      })
    } else if (payload.eventType === 'UPDATE') {
      const task = payload.new as { id: string; title: string; status: string }
      const oldTask = payload.old as { id: string; title: string; status: string } | undefined
      
      if (oldTask && task.status !== oldTask.status) {
        const statusMessages = {
          'pending': 'Oczekujące',
          'in_progress': 'W trakcie',
          'completed': 'Zakończone',
          'cancelled': 'Anulowane'
        }
        
        toast({
          title: 'Status zadania zmieniony',
          description: `Zadanie "${task.title}" ma teraz status: ${statusMessages[task.status as keyof typeof statusMessages] || task.status}`,
          variant: 'success',
          duration: 4000,
        })
      }
    }
  }, [toast])

  useEffect(() => {
    // Nasłuchuj na powiadomienia z Supabase Realtime
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const notification = payload.new as Notification
          showNotification(notification)
        }
      )
      .subscribe()

    // Nasłuchuj na powiadomienia o zadanach
    const tasksChannel = supabase
      .channel('task-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          handleTaskNotification(payload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(tasksChannel)
    }
  }, [showNotification, handleTaskNotification])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'destructive':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  // Funkcje pomocnicze do wyświetlania powiadomień
  const showSuccess = useCallback((title: string, message: string) => {
    toast({
      title,
      description: message,
      variant: 'success',
      duration: 4000,
    })
  }, [toast])

  const showError = useCallback((title: string, message: string) => {
    toast({
      title,
      description: message,
      variant: 'destructive',
      duration: 6000,
    })
  }, [toast])

  const showWarning = useCallback((title: string, message: string) => {
    toast({
      title,
      description: message,
      variant: 'warning',
      duration: 5000,
    })
  }, [toast])

  const showInfo = useCallback((title: string, message: string) => {
    toast({
      title,
      description: message,
      variant: 'info',
      duration: 4000,
    })
  }, [toast])

  // Eksportuj funkcje do globalnego użycia
  useEffect(() => {
    window.showNotification = {
      success: showSuccess,
      error: showError,
      warning: showWarning,
      info: showInfo,
    }
  }, [showSuccess, showError, showWarning, showInfo])

  return null // Ten komponent nie renderuje niczego wizualnie
}

