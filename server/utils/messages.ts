export type Message = {
  id: string
  name: string
  body: string
  status: 'pending' | 'approved'
  submittedAt: number
  approvedAt?: number
}

const EXPIRE_MS = 30 * 60 * 1000   // 30 minutes after approval
const RATE_LIMIT_MS = 15 * 60 * 1000 // 1 message per 15 minutes per IP

type Store = {
  messages: Message[]
  lastSubmit: Record<string, number>
  adminSessions: Set<string>
}

function getStore(): Store {
  const g = globalThis as { __store?: Store }
  if (!g.__store) g.__store = { messages: [], lastSubmit: {}, adminSessions: new Set() }
  return g.__store
}

export function getApprovedMessages(): Message[] {
  const store = getStore()
  const now = Date.now()
  // Prune expired approved messages
  store.messages = store.messages.filter(
    m => m.status === 'pending' || (m.approvedAt != null && now - m.approvedAt < EXPIRE_MS)
  )
  return store.messages.filter(m => m.status === 'approved')
}

export function getPendingMessages(): Message[] {
  return getStore().messages.filter(m => m.status === 'pending')
}

export function addMessage(name: string, body: string, key: string): { ok: boolean; error?: string } {
  const store = getStore()
  const now = Date.now()
  const last = store.lastSubmit[key] ?? 0
  if (now - last < RATE_LIMIT_MS) {
    const mins = Math.ceil((RATE_LIMIT_MS - (now - last)) / 60_000)
    return { ok: false, error: `Du kan først sende igen om ${mins} minut${mins === 1 ? '' : 'ter'}.` }
  }
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  store.messages.push({ id, name, body, status: 'pending', submittedAt: now })
  
  store.lastSubmit[key] = now
  return { ok: true }
}

export function approveMessage(id: string): boolean {
  const msg = getStore().messages.find(m => m.id === id && m.status === 'pending')
  if (!msg) return false
  msg.status = 'approved'
  msg.approvedAt = Date.now()
  return true
}

export function rejectMessage(id: string): boolean {
  const store = getStore()
  const idx = store.messages.findIndex(m => m.id === id)
  if (idx === -1) return false
  store.messages.splice(idx, 1)
  return true
}

export function createAdminSession(): string {
  const token = crypto.randomUUID()
  getStore().adminSessions.add(token)
  return token
}

export function isValidAdminSession(token: string): boolean {
  return getStore().adminSessions.has(token)
}
