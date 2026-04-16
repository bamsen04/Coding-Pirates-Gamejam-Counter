import { createAdminSession } from '../../utils/messages'

export default defineEventHandler(async (event) => {
  const { password } = await readBody(event);
  const config = useRuntimeConfig();
  const adminPassword = config.adminPassword;

  if (password !== adminPassword) {
    throw createError({ statusCode: 401, message: 'Forkert adgangskode' })
  }

  return { token: createAdminSession() }
})
