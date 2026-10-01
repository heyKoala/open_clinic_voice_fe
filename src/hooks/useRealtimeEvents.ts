import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../store/uistore'
import { playnotificationsound } from '../components/sounds/soundsmanager'
import { api } from '../lib/api'

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${wsProtocol}//${window.location.host}/ws/events/`
type EventPayload = {
  type: string
  data: any
}

// Several screens open their own connection; only the one created with notify=true (the app shell)
// shows toasts and plays sounds, otherwise each event would be announced once per open connection.
export function useRealtimeEvents(onEvent?: (event: EventPayload) => void, { notify = false }: { notify?: boolean } = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEventRef = useRef(onEvent)
  const { addToast } = useUIStore()

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    let active = true
    const connect = async () => {
      if (!active) return

      let token = null
      try {
        const res = await api.get('/auth/ws-ticket/')
        token = res.data.ticket
      } catch (err) {
        console.error("Failed to get WS ticket", err)
        // Retry after delay
        if (active) {
          reconnectTimeoutRef.current = setTimeout(() => connect(), 3000)
        }
        return
      }
      // Unmounted while the ticket was being fetched: don't open a socket nobody will close.
      if (!active) return

      const activeClinicId = localStorage.getItem('active_clinic_id')
      let url = token ? `${WS_URL}?token=${token}` : WS_URL
      if (activeClinicId) {
        url += `${url.includes('?') ? '&' : '?'}active_clinic_id=${activeClinicId}`
      }
      
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (active) {
          setIsConnected(true)
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }
        }
      }

      ws.onmessage = (event) => {
        if (!active) return
        try {
          const payload = JSON.parse(event.data) as EventPayload
          
          if (payload.type === 'connection.established') {
            console.log('Real-time events connected.')
            return
          }

          if (onEventRef.current) {
            onEventRef.current(payload)
          }

          if (!notify) return

          // Trigger ring for relevant updates
          if (
            payload.type.startsWith('appointment.') ||
            payload.type.startsWith('patient.') ||
            payload.type.startsWith('queue.')
          ) {
            playnotificationsound()
          }

          // Generic handling for appointment updates
          // Status changes (check-in, marked seen, ...) are not reschedules and the person who made
          // them already gets their own confirmation, so only announce new, moved or cancelled bookings.
          if (payload.type === 'appointment.created' || payload.type === 'appointment.updated') {
            const { patient_name, starts_at, status, rescheduled, status_changed } = payload.data
            const time = starts_at ? new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' }).format(new Date(starts_at)) : ''
            if (payload.type === 'appointment.created') {
              addToast(`Appointment with ${patient_name} created for ${time}.`, 'success')
            } else if (rescheduled) {
              addToast(`Appointment with ${patient_name} moved to ${time}.`, 'success')
            } else if (status_changed && status === 'cancelled') {
              addToast(`Appointment with ${patient_name} at ${time} was cancelled.`, 'info')
            }
          }

          // Generic handling for patient updates
          if (payload.type === 'patient.created') {
            addToast(`New patient ${payload.data.full_name} registered successfully.`, 'success')
          } else if (payload.type === 'patient.updated') {
            addToast(`Patient chart for ${payload.data.full_name} was updated.`, 'info')
          }

        } catch (e) {
          console.error('Failed to parse websocket message', e)
        }
      }

      ws.onclose = () => {
        if (active) {
          setIsConnected(false)
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => connect(), 3000)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        ws.close()
      }
    }

    connect()

    return () => {
      active = false
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [addToast, notify])

  return { isConnected }
}
