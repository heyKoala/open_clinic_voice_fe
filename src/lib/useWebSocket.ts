import { useEffect, useRef, useState, useCallback } from 'react'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useQueueWebSocket(doctorId: number | null) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<any>(null)
  const isUnmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (!doctorId || isUnmountedRef.current) return

    setStatus('connecting')
    
    // Same host as the page: Vite proxies /ws to the backend (works through a tunnel too).
    const urlObj = new URL(import.meta.env.VITE_API_BASE_URL ?? '/', window.location.origin)
    const protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:'
    let wsUrl = `${protocol}//${urlObj.host}/ws/queue/${doctorId}/`
    const activeClinicId = localStorage.getItem('active_clinic_id')
    if (activeClinicId) {
      wsUrl += `?active_clinic_id=${activeClinicId}`
    }
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!isUnmountedRef.current) {
        setStatus('connected')
      }
    }

    ws.onmessage = (event) => {
      if (isUnmountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
      } catch (err) {
        console.error("Error parsing websocket message", err)
      }
    }

    ws.onclose = () => {
      if (isUnmountedRef.current) return
      setStatus('disconnected')
      // Auto-reconnect after 5 seconds if not unmounted
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          connect()
        }
      }, 5000)
    }

    ws.onerror = () => {
      if (!isUnmountedRef.current) {
        setStatus('error')
      }
    }
  }, [doctorId])

  useEffect(() => {
    isUnmountedRef.current = false
    connect()

    return () => {
      isUnmountedRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { status, lastMessage }
}
