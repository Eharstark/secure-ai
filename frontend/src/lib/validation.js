// Client-side mirror of the backend's registration rules (app/schemas/user.py). Only for fast feedback:
// the server remains the authority and its errors are always displayed too.
const USERNAME_RE = /^[A-Za-z0-9_.-]+$/

export function validateUsername(value) {
  const v = value.trim()
  if (!v) return 'Username is required.'
  if (v.length < 3) return 'Username must be at least 3 characters.'
  if (v.length > 32) return 'Username must be at most 32 characters.'
  if (!USERNAME_RE.test(v)) return 'Use only letters, digits, dot, underscore or hyphen.'
  return null
}

export function validateNewPassword(password, username) {
  if (!password) return 'Password is required.'
  if (password.length < 12) return 'Password must be at least 12 characters.'
  if (password.length > 128) return 'Password must be at most 128 characters.'
  if (username && password.toLowerCase().includes(username.trim().toLowerCase())) return 'Password must not contain the username.'
  if (new Set(password).size < 5) return 'Password is too repetitive.'
  return null
}

export function passwordStrength(password) {
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 4)
}
