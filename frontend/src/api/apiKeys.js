import { http } from './client.js'

export const listApiKeys = () => http.get('/api-keys').then((r) => r.data)
export const createApiKey = ({ name, expiresInDays }) =>
  http.post('/api-keys', { name, ...(expiresInDays ? { expires_in_days: expiresInDays } : {}) }).then((r) => r.data)
export const revokeApiKey = (id) => http.delete(`/api-keys/${id}`).then(() => undefined)
