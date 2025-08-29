import { useToast } from './useToast'

export function useNotifications() {
  const { toast } = useToast()

  const showSuccess = (title: string, message: string, duration?: number) => {
    toast({
      title,
      description: message,
      variant: 'success',
      duration: duration || 4000,
    })
  }

  const showError = (title: string, message: string, duration?: number) => {
    toast({
      title,
      description: message,
      variant: 'destructive',
      duration: duration || 6000,
    })
  }

  const showWarning = (title: string, message: string, duration?: number) => {
    toast({
      title,
      description: message,
      variant: 'warning',
      duration: duration || 5000,
    })
  }

  const showInfo = (title: string, message: string, duration?: number) => {
    toast({
      title,
      description: message,
      variant: 'info',
      duration: duration || 4000,
    })
  }

  const showTaskCreated = (taskTitle: string, taskId: string) => {
    toast({
      title: 'Zadanie utworzone',
      description: `Pomyślnie utworzono zadanie: ${taskTitle}`,
      variant: 'success',
      duration: 4000,
      action: (
        <button
          onClick={() => window.open(`/dashboard/tasks/${taskId}`, '_blank')}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
        >
          Zobacz zadanie
        </button>
      ),
    })
  }

  const showTaskUpdated = (taskTitle: string, taskId: string) => {
    toast({
      title: 'Zadanie zaktualizowane',
      description: `Pomyślnie zaktualizowano zadanie: ${taskTitle}`,
      variant: 'success',
      duration: 4000,
      action: (
        <button
          onClick={() => window.open(`/dashboard/tasks/${taskId}`, '_blank')}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
        >
          Zobacz zadanie
        </button>
      ),
    })
  }

  const showTaskDeleted = (taskTitle: string) => {
    toast({
      title: 'Zadanie usunięte',
      description: `Pomyślnie usunięto zadanie: ${taskTitle}`,
      variant: 'success',
      duration: 4000,
    })
  }

  const showUserCreated = (userName: string) => {
    toast({
      title: 'Użytkownik utworzony',
      description: `Pomyślnie utworzono użytkownika: ${userName}`,
      variant: 'success',
      duration: 4000,
    })
  }

  const showUserUpdated = (userName: string) => {
    toast({
      title: 'Użytkownik zaktualizowany',
      description: `Pomyślnie zaktualizowano użytkownika: ${userName}`,
      variant: 'success',
      duration: 4000,
    })
  }

  const showUserDeleted = (userName: string) => {
    toast({
      title: 'Użytkownik usunięty',
      description: `Pomyślnie usunięto użytkownika: ${userName}`,
      variant: 'success',
      duration: 4000,
    })
  }

  const showFileUploaded = (fileName: string) => {
    toast({
      title: 'Plik przesłany',
      description: `Pomyślnie przesłano plik: ${fileName}`,
      variant: 'success',
      duration: 4000,
    })
  }

  const showFileDeleted = (fileName: string) => {
    toast({
      title: 'Plik usunięty',
      description: `Pomyślnie usunięto plik: ${fileName}`,
      variant: 'success',
      duration: 4000,
    })
  }

  const showSettingsSaved = () => {
    toast({
      title: 'Ustawienia zapisane',
      description: 'Pomyślnie zapisano ustawienia systemu',
      variant: 'success',
      duration: 3000,
    })
  }

  const showConnectionError = () => {
    toast({
      title: 'Błąd połączenia',
      description: 'Nie udało się połączyć z serwerem. Sprawdź połączenie internetowe.',
      variant: 'destructive',
      duration: 8000,
    })
  }

  const showPermissionDenied = () => {
    toast({
      title: 'Brak uprawnień',
      description: 'Nie masz uprawnień do wykonania tej operacji.',
      variant: 'destructive',
      duration: 5000,
    })
  }

  const showValidationError = (message: string) => {
    toast({
      title: 'Błąd walidacji',
      description: message,
      variant: 'destructive',
      duration: 5000,
    })
  }

  const showNetworkError = () => {
    toast({
      title: 'Błąd sieci',
      description: 'Wystąpił błąd podczas komunikacji z serwerem.',
      variant: 'destructive',
      duration: 6000,
    })
  }

  const showGenericError = (message: string) => {
    toast({
      title: 'Wystąpił błąd',
      description: message,
      variant: 'destructive',
      duration: 6000,
    })
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showTaskCreated,
    showTaskUpdated,
    showTaskDeleted,
    showUserCreated,
    showUserUpdated,
    showUserDeleted,
    showFileUploaded,
    showFileDeleted,
    showSettingsSaved,
    showConnectionError,
    showPermissionDenied,
    showValidationError,
    showNetworkError,
    showGenericError,
  }
}

