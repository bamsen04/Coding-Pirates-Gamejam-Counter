import { getApprovedMessages } from '../utils/messages'

export default defineEventHandler(() => {
  return getApprovedMessages().map(({ name, body }) => ({ name, body }))
})
