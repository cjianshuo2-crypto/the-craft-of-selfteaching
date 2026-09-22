import { rm } from 'node:fs/promises'
import path from 'node:path'
import {
  generatedBookDir,
  generatedImagesDir,
  projectRoot,
  siteDir,
} from './site-core.mjs'

const targets = [
  generatedBookDir,
  generatedImagesDir,
  path.join(siteDir, '.vitepress', 'cache'),
  path.join(siteDir, '.vitepress', 'dist'),
]

for (const target of targets) {
  const relativePath = path.relative(projectRoot, target)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to remove a path outside the project: ${target}`)
  }
  await rm(target, { recursive: true, force: true })
}

console.log('Removed generated site files.')
