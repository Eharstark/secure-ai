import { http } from './client.js'

export const listUsersPage = (limit = 100, offset = 0) =>
  http.get('/admin/users', { params: { limit, offset } }).then((r) => r.data)

// The backend returns a plain array without a total, so we page until a short page comes back.
export async function listAllUsers({ pageSize = 100, maxPages = 50 } = {}) {
  const all = []
  for (let page = 0; page < maxPages; page++) {
    const batch = await listUsersPage(pageSize, page * pageSize)
    all.push(...batch)
    if (batch.length < pageSize) return { users: all, truncated: false }
  }
  return { users: all, truncated: true }
}

export const updateUser = (id, changes) => http.patch(`/admin/users/${id}`, changes).then((r) => r.data)
