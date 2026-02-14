/**
 * Syncs TypeScript lib *.d.ts from the project's typescript into vite-plugin-checker's
 * typescript-vue-tsc/lib so in-dev vue-tsc can resolve all global types (Array, Object, DOM, etc.).
 * Run automatically before `pnpm dev` (predev); safe to run manually. No-op if typescript-vue-tsc
 * does not exist yet (created by the plugin on first dev run).
 */
import { access, copyFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const projectTsLib = dirname(require.resolve('typescript'))
const pnpmStore = join(process.cwd(), 'node_modules', '.pnpm')
const entries = await readdir(pnpmStore, { withFileTypes: true })
const checkerDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('vite-plugin-checker@'))
if (checkerDirs.length === 0) {
  process.exit(0)
}

async function main() {
  const libFiles = (await readdir(projectTsLib, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith('.d.ts'))
    .map((e) => e.name)
  if (libFiles.length === 0) {
    process.exit(0)
  }
  let totalCopied = 0
  for (const checkerDir of checkerDirs) {
    const targetLib = join(pnpmStore, checkerDir.name, 'node_modules', 'vite-plugin-checker', 'dist', 'checkers', 'vueTsc', 'typescript-vue-tsc', 'lib')
    const tsVueTscDir = dirname(targetLib)
    try {
      await access(tsVueTscDir)
      await mkdir(targetLib, { recursive: true })
    } catch {
      continue
    }
    let copied = 0
    for (const name of libFiles) {
      const src = join(projectTsLib, name)
      const dest = join(targetLib, name)
      try {
        await copyFile(src, dest)
        copied++
      } catch {
        // ignore
      }
    }
    if (copied > 0) {
      totalCopied += copied
    }
  }
  if (totalCopied > 0) {
    console.log('[fix-vue-tsc-lib] Synced', totalCopied, 'lib files for vue-tsc.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
