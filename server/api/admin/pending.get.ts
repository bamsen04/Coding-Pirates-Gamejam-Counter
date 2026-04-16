import { getPendingMessages, isValidAdminSession } from '../../utils/messages'

export default defineEventHandler((event) => {
  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token || !isValidAdminSession(token)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return getPendingMessages()
})
