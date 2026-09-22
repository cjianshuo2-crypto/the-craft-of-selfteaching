import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  flattenToc,
  generatedBookDir,
  generatedImagesDir,
  hashDirectory,
  imagesDir,
  markdownDir,
  projectRoot,
  readToc,
} from '../scripts/site-core.mjs'

test('site generation preserves upstream content', async () => {
  const beforeMarkdown = await hashDirectory(markdownDir)
  const beforeImages = await hashDirectory(imagesDir)
  await import(`../scripts/prepare-site.mjs?test=${Date.now()}`)
  assert.equal(await hashDirectory(markdownDir), beforeMarkdown)
  assert.equal(await hashDirectory(imagesDir), beforeImages)
})

test('every TOC chapter is generated in order', async () => {
  const sections = await readToc()
  const chapters = flattenToc(sections)
  const generatedFiles = (await readdir(generatedBookDir))
    .filter((file) => file.endsWith('.md'))
    .sort()

  assert.equal(chapters.length, 46)
  assert.deepEqual(generatedFiles, chapters.map((chapter) => chapter.file).sort())

  const sidebar = JSON.parse(
    await readFile(path.join(generatedBookDir, 'sidebar.json'), 'utf8'),
  )
  assert.deepEqual(sidebar, sections)
})

test('generated local image references resolve', async () => {
  const chapters = flattenToc(await readToc())
  const missing = []

  for (const chapter of chapters) {
    const source = await readFile(path.join(generatedBookDir, chapter.file), 'utf8')
    const references = source.matchAll(/(?:\]\(|src=["'])\/images\/([^)'"?\s]+)/g)
    for (const reference of references) {
      const imagePath = decodeURIComponent(reference[1])
      try {
        await access(path.join(generatedImagesDir, imagePath))
      } catch {
        missing.push(`${chapter.file}: ${imagePath}`)
      }
    }
  }

  assert.deepEqual(missing, [])
})

test('generated chapters contain balanced HTML anchors', async () => {
  const chapters = flattenToc(await readToc())

  for (const chapter of chapters) {
    const source = await readFile(path.join(generatedBookDir, chapter.file), 'utf8')
    const openingAnchors = (source.match(/<a\b/gi) || []).length
    const closingAnchors = (source.match(/<\/a>/gi) || []).length
    assert.equal(closingAnchors, openingAnchors, chapter.file)
  }
})

test('homepage contains attribution and license boundaries', async () => {
  const homepage = await readFile(path.join(projectRoot, 'site', 'index.md'), 'utf8')
  assert.match(homepage, /李笑来/)
  assert.match(homepage, /CC BY-NC-ND/)
  assert.match(homepage, /github\.com\/xiaolai\/the-craft-of-selfteaching/)
  assert.doesNotMatch(homepage, /广告|付费阅读|AI 问答/)
})
