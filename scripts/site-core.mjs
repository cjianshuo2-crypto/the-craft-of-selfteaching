import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

export const projectRoot = path.resolve(import.meta.dirname, '..')
export const markdownDir = path.join(projectRoot, 'markdown')
export const imagesDir = path.join(projectRoot, 'images')
export const siteDir = path.join(projectRoot, 'site')
export const generatedBookDir = path.join(siteDir, 'book')
export const generatedImagesDir = path.join(siteDir, 'public', 'images')

const tocEntryPattern = /^- \[([^\]]+)\]\(([^)]+\.md)\)$/
const tocSectionPattern = /^## (.+)$/

export async function readToc() {
  const source = await readFile(path.join(markdownDir, 'TOC.md'), 'utf8')
  const sections = []
  let current = null

  for (const line of source.split(/\r?\n/)) {
    const sectionMatch = line.match(tocSectionPattern)
    if (sectionMatch) {
      current = { text: sectionMatch[1].trim(), items: [] }
      sections.push(current)
      continue
    }

    const entryMatch = line.match(tocEntryPattern)
    if (entryMatch && current) {
      current.items.push({ text: entryMatch[1].trim(), file: entryMatch[2] })
    }
  }

  return sections.filter((section) => section.items.length > 0)
}

export function flattenToc(sections) {
  return sections.flatMap((section) => section.items)
}

export function transformMarkdown(source, availableMarkdownFiles) {
  let output = source

  // Use local copies for images that belong to the upstream repository.
  output = output.replace(
    /https:\/\/raw\.githubusercontent\.com\/(?:selfteaching|xiaolai)\/the-craft-of-selfteaching\/master\/images\/([^\s)]+?)(?:\?raw=true)?(?=[)\s])/g,
    '/images/$1',
  )
  output = output.replace(/(\]\()(?:\.\.\/)?images\//g, '$1/images/')
  output = output.replace(/(<img\s+[^>]*?src=["'])(?:\.\.\/)?images\//gi, '$1/images/')
  output = output.replace(/\]\(docs\.python\.org\//g, '](https://docs.python.org/')
  output = output.replace(
    /\]\(Part\.2\.D\.deliberate-thinking\.md/g,
    '](Part.2.E.deliberate-thinking.md',
  )

  // Prefer the published Markdown chapter when the book links to its notebook.
  output = output.replace(/\(([^)\s]+)\.ipynb(#[^)]+)?\)/g, (match, stem, hash = '') => {
    const markdownFile = `${stem}.md`
    return availableMarkdownFiles.has(markdownFile)
      ? `(${markdownFile}${hash})`
      : match
  })

  // The historical Markdown contains a few malformed footnote anchors that
  // browsers tolerated but Vue's template compiler correctly rejects. Repair
  // only the generated presentation copy.
  output = output
    .split(/\r?\n/)
    .map((line) => {
      const openingAnchors = (line.match(/<a\b/gi) || []).length
      const closingAnchors = (line.match(/<\/a>/gi) || []).length

      if (openingAnchors > closingAnchors && /<small>.*<\/small>/.test(line)) {
        return `${line}</a>`
      }
      if (closingAnchors > openingAnchors) {
        let repaired = line
        for (let count = 0; count < closingAnchors - openingAnchors; count += 1) {
          const lastClosingAnchor = repaired.toLowerCase().lastIndexOf('</a>')
          repaired = `${repaired.slice(0, lastClosingAnchor)}${repaired.slice(lastClosingAnchor + 4)}`
        }
        return repaired
      }
      return line
    })
    .join('\n')

  return output
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath)))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files.sort()
}

export async function hashDirectory(directory) {
  const digest = createHash('sha256')
  const files = await walkFiles(directory)

  for (const file of files) {
    const relativePath = path.relative(directory, file).replaceAll('\\', '/')
    const metadata = await stat(file)
    digest.update(relativePath)
    digest.update(String(metadata.size))
    digest.update(await readFile(file))
  }

  return digest.digest('hex')
}
