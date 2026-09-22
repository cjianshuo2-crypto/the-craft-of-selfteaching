import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  flattenToc,
  generatedBookDir,
  generatedImagesDir,
  imagesDir,
  markdownDir,
  readToc,
  transformMarkdown,
} from './site-core.mjs'

const sections = await readToc()
const chapters = flattenToc(sections)
const availableMarkdownFiles = new Set(chapters.map((chapter) => chapter.file))

await mkdir(generatedBookDir, { recursive: true })
await mkdir(generatedImagesDir, { recursive: true })

for (const chapter of chapters) {
  const sourcePath = path.join(markdownDir, chapter.file)
  const destinationPath = path.join(generatedBookDir, chapter.file)
  const source = await readFile(sourcePath, 'utf8')
  const transformed = transformMarkdown(source, availableMarkdownFiles)
  await writeFile(destinationPath, transformed, 'utf8')
}

await cp(imagesDir, generatedImagesDir, { recursive: true, force: true })
await writeFile(
  path.join(generatedBookDir, 'sidebar.json'),
  `${JSON.stringify(sections, null, 2)}\n`,
  'utf8',
)

console.log(`Prepared ${chapters.length} chapters and local images.`)
