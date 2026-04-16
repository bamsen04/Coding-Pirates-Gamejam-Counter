import { addMessage } from '../utils/messages'

export default defineEventHandler(async (event) => {
  const { name, body } = await readBody(event)

  if (!name?.trim() || !body?.trim()) {
    throw createError({ statusCode: 400, message: 'Name and body are required' })
  }

  let rlKey = getCookie(event, 'rl')
  if (!rlKey) {
    rlKey = crypto.randomUUID()
    setCookie(event, 'rl', rlKey, { httpOnly: true, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }

  const result = addMessage(name.trim(), body.trim(), rlKey)

  if (!result.ok) {
    throw createError({ statusCode: 429, message: result.error })
  }

  return { ok: true, pending: true }
})
