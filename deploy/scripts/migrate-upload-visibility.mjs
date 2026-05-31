#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(root, 'apps/api/uploads'))
const sensitiveGroups = new Set(['aftersale', 'admin', 'cert', 'business_license', 'private'])

function normalizeGroupName(groupName) {
  const normalized = String(groupName || '').trim().toLowerCase()
  return normalized || null
}

function isSensitive(groupName) {
  const normalized = normalizeGroupName(groupName)
  return !!normalized && sensitiveGroups.has(normalized)
}

function resolveCurrentFile(filePath, fileName) {
  const storedPath = String(filePath || '').replaceAll('\\', '/')
  if (storedPath.startsWith('/uploads/')) {
    return path.join(uploadDir, storedPath.slice('/uploads/'.length))
  }
  return path.join(uploadDir, fileName || path.basename(storedPath))
}

const prisma = new PrismaClient()

try {
  const files = await prisma.fileAsset.findMany()
  let moved = 0
  let updated = 0

  for (const file of files) {
    const visibility = isSensitive(file.groupName) ? 'private' : 'public'
    const fileName = file.fileName || path.basename(String(file.filePath || ''))
    if (!fileName) continue

    const nextRelativePath = `/uploads/${visibility}/${fileName}`
    const nextUrl = visibility === 'public' ? nextRelativePath : null
    const currentPath = resolveCurrentFile(file.filePath, fileName)
    const nextPath = path.join(uploadDir, visibility, fileName)

    if (path.resolve(currentPath) !== path.resolve(nextPath) && fs.existsSync(currentPath)) {
      fs.mkdirSync(path.dirname(nextPath), { recursive: true })
      if (!fs.existsSync(nextPath)) {
        fs.renameSync(currentPath, nextPath)
        moved += 1
      }
    }

    if (file.filePath !== nextRelativePath || file.url !== nextUrl || file.groupName !== normalizeGroupName(file.groupName)) {
      await prisma.fileAsset.update({
        where: { id: file.id },
        data: {
          filePath: nextRelativePath,
          url: nextUrl,
          groupName: normalizeGroupName(file.groupName),
        },
      })
      updated += 1
    }
  }

  console.log(`upload visibility migration completed: moved=${moved}, updated=${updated}`)
} finally {
  await prisma.$disconnect()
}
