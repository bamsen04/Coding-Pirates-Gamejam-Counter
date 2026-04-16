import { approveMessage, isValidAdminSession } from '../../utils/messages'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token || !isValidAdminSession(token)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const { id } = await readBody(event)
  if (!approveMessage(id)) {
    throw createError({ statusCode: 404, message: 'Message not found' })
  }
  return { ok: true }
})
