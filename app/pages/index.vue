<template>
  <div class="wrapper">
    <!-- Floating messages — rendered first so counter/FAB stack above them -->
    <div
      v-for="(msg, i) in floatingMessages"
      :key="i"
      class="floating-msg"
      :style="msg.style"
    >
      <span class="msg-name">{{ msg.name }}</span>
      <p class="msg-body">{{ msg.body }}</p>
    </div>

    <span class="counter">{{ display }}</span>

    <template v-if="showForm">
      <button class="fab" @click="open = true" aria-label="Indsend bidrag">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <Transition name="modal">
        <div v-if="open" class="overlay" @click.self="open = false">
          <div class="modal">
            <form @submit.prevent="submitMessage">
              <div class="field">
                <label for="name">Navn</label>
                <input v-model="formName" type="text" name="name" id="name" placeholder="Dit navn" :disabled="submitting" />
              </div>
              <div class="field">
                <label for="body">Besked</label>
                <textarea v-model="formBody" name="body" id="body" rows="4" placeholder="Held og lykke til alle!" :disabled="submitting" />
              </div>
              <p v-if="submitError" class="form-error">{{ submitError }}</p>
              <p v-if="submitSuccess" class="form-success">Din besked afventer godkendelse.</p>
              <button type="submit" :disabled="submitting">{{ submitting ? 'Sender...' : 'Indsend besked' }}</button>
            </form>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
// Change this date to set the countdown target (midnight local time on that day)
const TARGET = new Date('2026-04-17T00:00:00')

function getTimeLeft() {
  const diff = TARGET.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  }
}

const timeLeft = ref(getTimeLeft())
let timerId: ReturnType<typeof setInterval>
let messageId: ReturnType<typeof setInterval>

const pad = (n: number) => String(n).padStart(2, '0')
const display = computed(() => {
  const { days, hours, minutes, seconds } = timeLeft.value
  return days > 0
    ? `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
})

const route = useRoute()
const showForm = computed(() => route.hash !== '#no-form')
const open = ref(false)

// Form state
const formName = ref('')
const formBody = ref('')
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

// Messages
interface Message { name: string; body: string }
const { data: messages, refresh: refreshMessages } = await useFetch<Message[]>('/api/message')

onMounted(() => {
  timerId = setInterval(() => { timeLeft.value = getTimeLeft() }, 1000)
  messageId = setInterval(refreshMessages, 10_000)
})
onUnmounted(() => {
  clearInterval(timerId)
  clearInterval(messageId)
})

async function submitMessage() {
  if (!formName.value.trim() || !formBody.value.trim()) return
  submitting.value = true
  submitError.value = ''
  submitSuccess.value = false
  try {
    await $fetch('/api/message', {
      method: 'POST',
      body: { name: formName.value, body: formBody.value },
    })
    formName.value = ''
    formBody.value = ''
    submitSuccess.value = true
    setTimeout(() => { open.value = false; submitSuccess.value = false }, 2000)
  } catch (err: any) {
    submitError.value = err?.data?.message ?? 'Noget gik galt. Prøv igen.'
  } finally {
    submitting.value = false
  }
}

// Deterministic pseudo-random based on index + salt (same render on SSR & client)
function h(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x) // 0–1
}

// Place each message in its own slot within the top or bottom strip.
// Slots divide the usable width evenly so messages never overlap.
function getPosition(index: number, total: number) {
  const zone     = index % 2                              // 0 = top, 1 = bottom
  const slotIdx  = Math.floor(index / 2)                  // position within this zone
  const zoneCount = zone === 0 ? Math.ceil(total / 2) : Math.floor(total / 2)

  const usable = 83                                       // usable width: 5 %–88 %
  const slotW  = zoneCount > 0 ? usable / zoneCount : usable
  const slotCenter = 5 + (slotIdx + 0.5) * slotW
  const jitter = (h(index, 0) - 0.5) * slotW * 0.4      // ±20 % of slot width
  const x = Math.max(2, Math.min(88, slotCenter + jitter))

  const y = zone === 0
    ? h(index, 1) * 8 + 3   // top strip:    3–11 %
    : h(index, 3) * 5 + 79  // bottom strip: 79–84 %

  return {
    left:    `${x.toFixed(1)}%`,
    top:     `${y.toFixed(1)}%`,
    '--dur': `${(h(index, 8) * 7 + 7).toFixed(1)}s`,
    '--dly': `${(h(index, 9) * -12).toFixed(1)}s`,
    '--rot': `${((h(index, 10) - 0.5) * 8).toFixed(1)}deg`,
  }
}

const floatingMessages = computed(() => {
  const msgs = messages.value ?? []
  return msgs.map((msg, i) => ({ ...msg, style: getPosition(i, msgs.length) }))
})
</script>

<style>
@keyframes msg-float {
  0%, 100% { transform: translateY(0px)   rotate(0deg); }
  33%      { transform: translateY(-13px) rotate(calc(var(--rot) * 0.8)); }
  66%      { transform: translateY(9px)  rotate(calc(var(--rot) * -0.5)); }
}

.floating-msg {
  position: fixed;
  max-width: 260px;
  padding: 14px 18px;
  background: rgba(10, 10, 20, 0.82);
  border: 1px solid rgba(255, 0, 255, 0.35);
  border-radius: 10px;
  box-shadow: 0 0 14px rgba(255, 0, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
  z-index: 1;
  animation: msg-float var(--dur, 10s) var(--dly, 0s) ease-in-out infinite;
}

.msg-name {
  font-size: 0.72rem;
  color: #f0f;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.msg-body {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.45;
  word-break: break-word;
}

.form-error {
  color: #f66;
  font-size: 0.85rem;
  margin: 0;
}

.form-success {
  color: #0f6;
  font-size: 0.85rem;
  margin: 0;
}
</style>
