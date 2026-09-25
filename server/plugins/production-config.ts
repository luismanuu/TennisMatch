import { resolveServerConfig } from '../utils/server-config'

// Fail closed at startup: in production (NODE_ENV=production and VERCEL_ENV=production) a missing email
// sender or base URL throws here, so the function never serves a request with open sign-up or
// unpinned links. Previews and local dev resolve without throwing. See server/utils/server-config.ts.
export default defineNitroPlugin(() => {
  resolveServerConfig()
})
