import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { flattenToc, markdownDir, projectRoot, readToc } from './site-core.mjs'

const requiredFiles = [
  'AGENTS.md',
  'package.json',
  'site/index.md',
  'site/.vitepress/config.mts',
  'site/.vitepress/theme/index.mts',
  'site/.vitepress/theme/custom.css',
  'site/.vitepress/theme/components/annotation-tools.vue',
  'site/.vitepress/theme/annotations/model.mjs',
  'site/.vitepress/theme/annotations/dom.mjs',
  '.github/workflows/deploy-pages.yml',
]

for (const file of requiredFiles) {
  await access(path.join(projectRoot, file))
}

const sections = await readToc()
const chapters = flattenToc(sections)

if (sections.length !== 6) {
  throw new Error(`Expected 6 TOC sections, found ${sections.length}.`)
}
if (chapters.length < 40) {
  throw new Error(`Expected at least 40 chapters, found ${chapters.length}.`)
}

for (const chapter of chapters) {
  await access(path.join(markdownDir, chapter.file))
}

const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
for (const script of ['docs:dev', 'docs:build', 'docs:preview', 'lint', 'test']) {
  if (!packageJson.scripts?.[script]) {
    throw new Error(`Missing npm script: ${script}`)
  }
}

console.log(`Lint passed for ${chapters.length} chapters in ${sections.length} sections.`)
