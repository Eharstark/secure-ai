import axios from 'axios'
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../lib/config.js'
import { getToken, invalidateSession } from '../lib/session.js'
import { normalizeError } from '../lib/errors.js'

// One shared client: base URL from the environment, bearer token attached from the session store,
// consistent error normalization, and automatic session invalidation on 401.
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
  withCredentials: false, // the backend CORS policy is intentionally non-credentialed
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    // A 401 on a request that carried our token means the session is expired or revoked.
    // Login/register calls opt out (skipAuth) because a 401 there just means "wrong credentials".
    if (status === 401 && !error.config?.skipAuth) {
      invalidateSession('expired')
    }
    return Promise.reject(normalizeError(error, API_BASE_URL))
  },
)
