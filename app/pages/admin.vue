<template>
  <div class="admin-wrapper">
    <!-- Login -->
    <div v-if="!token" class="login-card">
      <h1>Admin</h1>
      <form @submit.prevent="login">
        <input
          v-model="password"
          type="password"
          placeholder="Adgangskode"
          :disabled="loggingIn"
          autofocus
        />
        <button type="submit" :disabled="loggingIn">{{ loggingIn ? '...' : 'Log ind' }}</button>
        <p v-if="loginError" class="error">{{ loginError }}</p>
      </form>
    </div>

    <!-- Admin panel -->
    <div v-else class="panel">
      <header>
        <h1>Afventende beskeder <span class="badge">{{ pending.length }}</span></h1>
        <button class="logout-btn" @click="logout">Log ud</button>
      </header>

      <p v-if="pending.length === 0" class="empty">Ingen afventende beskeder.</p>

      <div v-for="msg in pending" :key="msg.id" class="msg-card">
        <div class="msg-meta">
          <span class="msg-name">{{ msg.name }}</span>
          <span class="msg-time">{{ timeAgo(msg.submittedAt) }}</span>
        </div>
        <p class="msg-body">{{ msg.body }}</p>
        <div class="msg-actions">
          <button class="approve-btn" :disabled="acting === msg.id" @click="approve(msg.id)">
            Godkend
          </button>
          <button class="reject-btn" :disabled="acting === msg.id" @click="reject(msg.id)">
            Afvis
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PendingMessage {
  id: string
  name: string
  body: string
  submittedAt: number
}

const password = ref('')
const loggingIn = ref(false)
const loginError = ref('')
const token = ref<string | null>(null)
const pending = ref<PendingMessage[]>([])
const acting = ref<string | null>(null)

onMounted(() => {
  token.value = localStorage.getItem('admin_token')
  if (token.value) fetchPending()
})

async function login() {
  loggingIn.value = true
  loginError.value = ''
  try {
    const res = await $fetch<{ token: string }>('/api/admin/login', {
      method: 'POST',
      body: { password: password.value },
    })
    token.value = res.token
    localStorage.setItem('admin_token', res.token)
    password.value = ''
    await fetchPending()
  } catch {
    loginError.value = 'Forkert adgangskode'
  } finally {
    loggingIn.value = false
  }
}

function logout() {
  token.value = null
  localStorage.removeItem('admin_token')
  pending.value = []
}

async function fetchPending() {
  try {
    pending.value = await $fetch<PendingMessage[]>('/api/admin/pending', {
      headers: { authorization: `Bearer ${token.value}` },
    })
  } catch (err: any) {
    if (err?.statusCode === 401) logout()
  }
}

async function approve(id: string) {
  acting.value = id
  try {
    await $fetch('/api/admin/approve', {
      method: 'POST',
      headers: { authorization: `Bearer ${token.value}` },
      body: { id },
    })
    await fetchPending()
  } finally {
    acting.value = null
  }
}

async function reject(id: string) {
  acting.value = id
  try {
    await $fetch('/api/admin/reject', {
      method: 'POST',
      headers: { authorization: `Bearer ${token.value}` },
      body: { id },
    })
    await fetchPending()
  } finally {
    acting.value = null
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `${mins} min siden`
  const hrs = Math.floor(mins / 60)
  return `${hrs} t siden`
}

// Poll for new pending messages every 10 seconds
onMounted(() => {
  const id = setInterval(() => { if (token.value) fetchPending() }, 10_000)
  onUnmounted(() => clearInterval(id))
})
</script>

<style scoped>
.admin-wrapper {
  min-height: 100vh;
  background: #0a0a0f;
  color: #fff;
  font-family: inherit;
  padding: 2rem 1rem;
  display: flex;
  justify-content: center;
}

.login-card {
  width: 100%;
  max-width: 360px;
  margin-top: 15vh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.login-card h1 {
  color: #f0f;
  font-size: 1.8rem;
  letter-spacing: 0.1em;
  text-shadow: 0 0 18px #f0f;
  margin: 0;
}

.login-card form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-card input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,0,255,0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  padding: 0.7rem 1rem;
  outline: none;
}

.login-card input:focus {
  border-color: #f0f;
  box-shadow: 0 0 8px rgba(255,0,255,0.3);
}

.login-card button, .panel button[type] {
  background: rgba(255,0,255,0.15);
  border: 1px solid rgba(255,0,255,0.5);
  border-radius: 8px;
  color: #f0f;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 0.7rem 1.2rem;
  transition: background 0.15s, box-shadow 0.15s;
}

.login-card button:hover:not(:disabled) {
  background: rgba(255,0,255,0.28);
  box-shadow: 0 0 12px rgba(255,0,255,0.3);
}

.error {
  color: #f66;
  font-size: 0.88rem;
  margin: 0;
}

/* Panel */
.panel {
  width: 100%;
  max-width: 680px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

header h1 {
  color: #f0f;
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  text-shadow: 0 0 14px #f0f;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.badge {
  background: rgba(255,0,255,0.2);
  border: 1px solid rgba(255,0,255,0.4);
  border-radius: 20px;
  color: #f0f;
  font-size: 0.85rem;
  padding: 0.1rem 0.55rem;
}

.logout-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0.4rem 0.8rem;
  transition: color 0.15s, border-color 0.15s;
}

.logout-btn:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.5);
}

.empty {
  color: rgba(255,255,255,0.4);
  font-size: 0.95rem;
  margin-top: 2rem;
  text-align: center;
}

.msg-card {
  background: rgba(10,10,20,0.82);
  border: 1px solid rgba(255,0,255,0.25);
  border-radius: 10px;
  box-shadow: 0 0 14px rgba(255,0,255,0.08);
  margin-bottom: 1rem;
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.msg-meta {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
}

.msg-name {
  color: #f0f;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.msg-time {
  color: rgba(255,255,255,0.35);
  font-size: 0.75rem;
}

.msg-body {
  color: rgba(255,255,255,0.8);
  font-size: 0.92rem;
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
}

.msg-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.approve-btn {
  background: rgba(0,255,100,0.12);
  border: 1px solid rgba(0,255,100,0.4);
  border-radius: 6px;
  color: #0f6;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 1rem;
  transition: background 0.15s;
}

.approve-btn:hover:not(:disabled) {
  background: rgba(0,255,100,0.22);
}

.reject-btn {
  background: rgba(255,60,60,0.1);
  border: 1px solid rgba(255,60,60,0.35);
  border-radius: 6px;
  color: #f66;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 1rem;
  transition: background 0.15s;
}

.reject-btn:hover:not(:disabled) {
  background: rgba(255,60,60,0.2);
}

.approve-btn:disabled, .reject-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
