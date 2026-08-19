import { ref } from 'vue'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
}

const toasts = ref<ToastMessage[]>([])

export function useToast() {
  function show(toast: Omit<ToastMessage, 'id'>) {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9)
    const newToast: ToastMessage = {
      id,
      duration: 4500,
      ...toast
    }

    toasts.value.push(newToast)

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        remove(id)
      }, newToast.duration)
    }

    return id
  }

  function success(message: string, title: string = 'Sucesso') {
    return show({ type: 'success', title, message })
  }

  function error(message: string, title: string = 'Erro') {
    return show({ type: 'error', title, message, duration: 6000 })
  }

  function warning(message: string, title: string = 'Atenção') {
    return show({ type: 'warning', title, message })
  }

  function info(message: string, title: string = 'Informação') {
    return show({ type: 'info', title, message })
  }

  function remove(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    remove
  }
}
