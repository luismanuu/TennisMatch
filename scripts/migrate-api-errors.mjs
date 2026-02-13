/**
 * One-time migration: add handleApiError import and replace catch blocks in server/api routes.
 * Run from repo root: node scripts/migrate-api-errors.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.join(__dirname, '..', 'server', 'api')

function getAllTsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) getAllTsFiles(full, files)
    else if (e.name.endsWith('.ts')) files.push(full)
  }
  return files
}

function getMethodAndPath(filePath) {
  const rel = path.relative(apiDir, filePath).replace(/\\/g, '/')
  const match = rel.match(/^(.+)\.(get|post|put|delete|patch)\.ts$/)
  if (!match) return null
  const [, route, method] = match
  const METHOD = method.toUpperCase()
  const apiPath = '/api/' + route
  return `${METHOD} ${apiPath}`
}

const CATCH_PATTERNS = [
  // With data and long statusMessage
  /\n  \} catch \(error: unknown\) \{\s*\n\s*const err = typeof error === 'object' && error !== null \? \(error as Record<string, unknown>\) : null\s*\n\s*throw createError\(\{\s*\n\s*statusCode: err && typeof err\['statusCode'\] === 'number' \? \(err\['statusCode'\] as number\) : 500,\s*\n\s*statusMessage:\s*\n\s*\(err && typeof err\['statusMessage'\] === 'string' \? \(err\['statusMessage'\] as string\) : undefined\) \|\|\s*\n\s*\(err && typeof err\['message'\] === 'string' \? \(err\['message'\] as string\) : undefined\) \|\|\s*\n\s*'Internal server error',\s*\n\s*data: err && 'data' in err \? err\['data'\] : error\s*\n\s*\}\)\s*\n  \}/g,
  // With data, short statusMessage
  /\n  \} catch \(error: unknown\) \{\s*\n\s*const err = typeof error === 'object' && error !== null \? \(error as Record<string, unknown>\) : null\s*\n\s*throw createError\(\{\s*\n\s*statusCode: err && typeof err\['statusCode'\] === 'number' \? \(err\['statusCode'\] as number\) : 500,\s*\n\s*statusMessage: err && typeof err\['statusMessage'\] === 'string' \? \(err\['statusMessage'\] as string\) : 'Internal server error',\s*\n\s*data: err && 'data' in err \? err\['data'\] : error\s*\n\s*\}\)\s*\n  \}/g,
  // No data, short statusMessage
  /\n  \} catch \(error: unknown\) \{\s*\n\s*const err = typeof error === 'object' && error !== null \? \(error as Record<string, unknown>\) : null\s*\n\s*throw createError\(\{\s*\n\s*statusCode: err && typeof err\['statusCode'\] === 'number' \? \(err\['statusCode'\] as number\) : 500,\s*\n\s*statusMessage: err && typeof err\['statusMessage'\] === 'string' \? \(err\['statusMessage'\] as string\) : 'Internal server error'\s*\n\s*\}\)\s*\n  \}/g,
  // With logger.error first (leaderboard)
  /\n  \} catch \(error: unknown\) \{\s*\n\s*const err = typeof error === 'object' && error !== null \? \(error as Record<string, unknown>\) : null\s*\n\s*logger\.error\([^)]+\)\s*\n\s*throw createError\(\{\s*\n\s*statusCode: err && typeof err\['statusCode'\] === 'number' \? \(err\['statusCode'\] as number\) : 500,\s*\n\s*statusMessage: err && typeof err\['statusMessage'\] === 'string' \? \(err\['statusMessage'\] as string\) : 'Internal server error'\s*\n\s*\}\)\s*\n  \}/g,
]

function replaceCatchBlock(content, pathStr) {
  const replacement = `\n  } catch (error: unknown) {\n    handleApiError(error, '${pathStr}')\n  }`
  for (const re of CATCH_PATTERNS) {
    if (re.test(content)) {
      return content.replace(re, replacement)
    }
  }
  // Fallback: try to match any } catch (error: unknown) { ... throw createError ... }
  const generic = content.match(/\n  \} catch \(error: unknown\) \{\s*\n[\s\S]*?throw createError\([\s\S]*?\}\)\s*\n  \}/)
  if (generic) {
    return content.replace(generic[0], replacement)
  }
  return null
}

function addImport(content) {
  if (content.includes("handleApiError")) return content
  // Add after first import that looks like server or h3
  const importLine = "import { handleApiError } from '~/server/utils/errors'"
  const match = content.match(/(import .+ from ['"]~(?:server|server\/)[^'"]+['"];?\n)/m)
  if (match) {
    return content.replace(match[1], match[1] + importLine + '\n')
  }
  const matchH3 = content.match(/(import .+ from ['"]h3['"];?\n)/m)
  if (matchH3) {
    return content.replace(matchH3[1], matchH3[1] + importLine + '\n')
  }
  // After first import line
  const firstImport = content.match(/(import .+;\n)/)
  if (firstImport) {
    return content.replace(firstImport[1], firstImport[1] + importLine + '\n')
  }
  return content
}

const files = getAllTsFiles(apiDir)
let updated = 0
for (const file of files) {
  const methodPath = getMethodAndPath(file)
  if (!methodPath) continue
  let content = fs.readFileSync(file, 'utf8')
  if (!content.includes('createError') && !content.includes('console.')) continue
  const newContent = replaceCatchBlock(content, methodPath)
  if (newContent) {
    content = addImport(newContent)
    fs.writeFileSync(file, content)
    updated++
    console.log('Updated:', path.relative(apiDir, file))
  }
}
console.log('Total updated:', updated)
