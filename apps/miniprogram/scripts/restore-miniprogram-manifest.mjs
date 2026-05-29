import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, '../src/manifest.json')
const backupPath = resolve(__dirname, '../src/manifest.json.bak')

if (existsSync(backupPath)) {
  writeFileSync(manifestPath, readFileSync(backupPath, 'utf-8'))
  unlinkSync(backupPath)
  console.log('manifest.json restored from backup')
} else {
  console.log('manifest backup not found, skip restore')
}
