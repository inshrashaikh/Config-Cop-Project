import { useState, useCallback, useRef } from 'react'

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const addToast = useCallback((message, variant = 'info', title = null, duration = 5000) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, variant, title }])
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
    return id
  }, [])

  const removeToast = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg, title) => addToast(msg, 'success', title),
    error:   (msg, title) => addToast(msg, 'error',   title, 7000),
    warning: (msg, title) => addToast(msg, 'warning', title),
    info:    (msg, title) => addToast(msg, 'info',    title),
  }

  return { toasts, toast, removeToast }
}
