import { http } from './client.js'

export const login = (username, password) =>
  http.post('/auth/login', { username, password }, { skipAuth: true }).then((r) => r.data)

// The payload deliberately has only username and password: the backend rejects any extra field
// (such as "role"), and the UI never offers a way to pick a role.
export const register = (username, password) =>
  http.post('/auth/register', { username, password }, { skipAuth: true }).then((r) => r.data)

export const fetchMe = () => http.get('/users/me').then((r) => r.data)
export const fetchHealth = () => http.get('/health', { skipAuth: true }).then((r) => r.data)
