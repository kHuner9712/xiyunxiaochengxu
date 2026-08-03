import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function collectVueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? collectVueFiles(path) : path.endsWith('.vue') ? [path] : []
  })
}

describe('native control clipping safety', () => {
  it('all inputs and textareas use explicit placeholder classes and safe dimensions', () => {
    const files = collectVueFiles(join(process.cwd(), 'src'))
    const tagPattern = /<(input|textarea)\b([^>]*)>/gis
    const failures: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(tagPattern)) {
        const tag = match[1].toLowerCase()
        const attrs = match[2]
        const className = attrs.match(/\bclass=["']([^"']+)["']/i)?.[1]?.split(/\s+/)[0]
        if (!attrs.includes('placeholder-class=')) {
          failures.push(`${file}: <${tag}> missing placeholder-class`)
        }
        if (!className) {
          failures.push(`${file}: <${tag}> missing class`)
          continue
        }
        const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const styleBlock = source.match(new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] || ''
        if (!/(?:^|\s)(?:height|min-height)\s*:/.test(styleBlock)) {
          failures.push(`${file}: .${className} missing height/min-height`)
        }
        if (!/(?:^|\s)line-height\s*:/.test(styleBlock)) {
          failures.push(`${file}: .${className} missing line-height`)
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })
})
