import { createEnrollToken, ENROLL_TOKEN_TTL_MS, ORIGIN } from "./passkeys";

const token = createEnrollToken();
console.log(`Open this link to register a passkey (valid for ${ENROLL_TOKEN_TTL_MS / 60000} minutes, single use):`);
console.log(`${ORIGIN}/admin/enroll?token=${token}`);
