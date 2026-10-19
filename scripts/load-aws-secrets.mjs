// Build-time configuration from AWS Secrets Manager (same pattern as the backend's config/aws_secrets.py).
//
// Runs automatically before `npm run build` (the "prebuild" script).
//
// - USE_AWS_SECRETS is the single switch. Off (the default) = nothing happens and the build uses the normal
//   environment / .env files, exactly as before.
// - On: fetch the JSON secret AWS_SECRETS_NAME from AWS_REGION_NAME (default ap-south-1) with the default AWS
//   credential chain (the CI/CD role on the build machine), and write its VITE_* keys to .env.production.local,
//   which Vite reads during the build. The file is git-ignored (*.local).
// - Only VITE_* keys are written: every VITE_ value is compiled into the public JavaScript, so the secret
//   must never hold a real secret under a VITE_ name. Other keys in the secret are ignored.
// - If the switch is on and the secret cannot be read, the build fails instead of shipping a broken app.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const TRUE_WORDS = new Set(['1', 'true', 'yes', 'on'])
const on = TRUE_WORDS.has(String(process.env.USE_AWS_SECRETS ?? '').trim().toLowerCase())

if (!on) {
  console.log('[aws-secrets] USE_AWS_SECRETS is off: using the normal environment.')
  process.exit(0)
}

const secretName = (process.env.AWS_SECRETS_NAME ?? '').trim()
const region = (process.env.AWS_REGION_NAME ?? '').trim() || 'ap-south-1'
if (!secretName) {
  console.error('[aws-secrets] USE_AWS_SECRETS is on but AWS_SECRETS_NAME is not set.')
  process.exit(1)
}

let payload
try {
  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
  const client = new SecretsManagerClient({ region })
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }))
  payload = JSON.parse(res.SecretString ?? '{}')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('the secret must be a JSON object')
} catch (err) {
  console.error(`[aws-secrets] Could not read secret "${secretName}" in ${region}: ${err?.message ?? err}`)
  process.exit(1)
}

const entries = Object.entries(payload).filter(([key]) => key.startsWith('VITE_'))
if (entries.length === 0) {
  console.error(`[aws-secrets] Secret "${secretName}" has no VITE_* keys (expected at least VITE_API_BASE_URL).`)
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lines = entries.map(([key, value]) => `${key}=${String(value).replace(/\r?\n/g, ' ')}`)
writeFileSync(join(root, '.env.production.local'), `# Written by scripts/load-aws-secrets.mjs from ${secretName}. Do not commit.\n${lines.join('\n')}\n`)
console.log(`[aws-secrets] Loaded ${entries.map(([k]) => k).join(', ')} from "${secretName}" (${region}).`)
