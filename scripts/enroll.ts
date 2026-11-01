import { config } from "../src/config";
import db from "../src/services/db";
import { createEnrollToken, ENROLL_TOKEN_TTL_MS } from "../src/services/passkeys";

const token = await createEnrollToken();
console.log(`Open this link to register a passkey (valid for ${ENROLL_TOKEN_TTL_MS / 60000} minutes, single use):`);
console.log(`${config.origin}/admin/enroll?token=${token}`);

await db.close();
