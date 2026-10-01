import axios from 'axios'

export const api = axios.create({
  // Relative: requests go to the page's own host and Vite forwards /api to the backend.
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
})

// Attach the Django CSRF token cookie as a header on all mutating requests.
// CookieJWTAuthentication enforces CSRF whenever a JWT access cookie is present,
// so any authenticated POST/PUT/PATCH/DELETE will be rejected without this.
api.interceptors.request.use((config) => {
  const safeMethods = ['get', 'head', 'options', 'trace']
  if (config.method && !safeMethods.includes(config.method.toLowerCase())) {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
    const csrfToken = match ? match[1] : null
    if (csrfToken) {
      config.headers.set('X-CSRFToken', csrfToken)
    }
  }
  const activeClinicId = localStorage.getItem('active_clinic_id')
  if (activeClinicId) {
    config.headers.set('X-Active-Clinic-Id', activeClinicId)
  }
  return config
})

// One refresh at a time: the refresh token rotates on use, so parallel refreshes would all but the
// first fail with the now-invalidated token (and could log the user out).
let refreshInFlight: Promise<unknown> | null = null

// Automatically refresh the access token on 401 Unauthorized errors.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== '/auth/refresh/') {
      originalRequest._retry = true
      try {
        refreshInFlight ??= api.post('/auth/refresh/').finally(() => { refreshInFlight = null })
        await refreshInFlight
        return api(originalRequest)
      } catch (refreshError) {
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)
