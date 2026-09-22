export const ANNOTATION_STORAGE_KEY = 'selfteaching.annotations.v1'
export const ANNOTATION_SCHEMA_VERSION = 1

function isFiniteInteger(value) {
  return Number.isInteger(value) && value >= 0
}

export function normalizeAnnotation(value) {
  if (!value || typeof value !== 'object') return null

  const requiredStrings = ['id', 'path', 'pageTitle', 'quote', 'note', 'prefix', 'suffix', 'createdAt']
  if (requiredStrings.some((key) => typeof value[key] !== 'string')) return null
  if (!value.id || !value.path.startsWith('/') || !value.quote.trim()) return null
  if (!isFiniteInteger(value.blockIndex) || !isFiniteInteger(value.quoteStart)) return null

  return {
    id: value.id.slice(0, 100),
    path: value.path.slice(0, 500),
    pageTitle: value.pageTitle.slice(0, 300),
    quote: value.quote.slice(0, 4000),
    note: value.note.slice(0, 10000),
    blockIndex: value.blockIndex,
    quoteStart: value.quoteStart,
    prefix: value.prefix.slice(-80),
    suffix: value.suffix.slice(0, 80),
    createdAt: value.createdAt,
  }
}

export function loadAnnotations(storage) {
  if (!storage) return []
  try {
    const raw = storage.getItem(ANNOTATION_STORAGE_KEY)
    if (!raw) return []
    const payload = JSON.parse(raw)
    if (payload?.version !== ANNOTATION_SCHEMA_VERSION || !Array.isArray(payload.items)) {
      return []
    }
    return payload.items.map(normalizeAnnotation).filter(Boolean)
  } catch {
    return []
  }
}

export function saveAnnotations(storage, items) {
  const normalizedItems = items.map(normalizeAnnotation).filter(Boolean)
  storage.setItem(
    ANNOTATION_STORAGE_KEY,
    JSON.stringify({ version: ANNOTATION_SCHEMA_VERSION, items: normalizedItems }),
  )
  return normalizedItems
}

export function createAnnotation(input) {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `note-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return normalizeAnnotation({
    ...input,
    id,
    createdAt: new Date().toISOString(),
  })
}

export function findQuoteOffset(blockText, annotation) {
  const expected = annotation.quoteStart
  if (blockText.slice(expected, expected + annotation.quote.length) === annotation.quote) {
    return expected
  }

  const matches = []
  let position = blockText.indexOf(annotation.quote)
  while (position !== -1) {
    matches.push(position)
    position = blockText.indexOf(annotation.quote, position + 1)
  }
  if (matches.length === 0) return -1
  if (matches.length === 1) return matches[0]

  const contextual = matches.find((start) => {
    const prefix = blockText.slice(Math.max(0, start - annotation.prefix.length), start)
    const suffix = blockText.slice(
      start + annotation.quote.length,
      start + annotation.quote.length + annotation.suffix.length,
    )
    return prefix.endsWith(annotation.prefix) && suffix.startsWith(annotation.suffix)
  })
  return contextual ?? matches[0]
}

export function annotationsOverlap(left, right) {
  if (left.path !== right.path || left.blockIndex !== right.blockIndex) return false
  const leftEnd = left.quoteStart + left.quote.length
  const rightEnd = right.quoteStart + right.quote.length
  return left.quoteStart < rightEnd && right.quoteStart < leftEnd
}

export function updateAnnotationNote(items, id, note) {
  const boundedNote = String(note ?? '').trim().slice(0, 10000)
  return items.map((item) => item.id === id ? { ...item, note: boundedNote } : item)
}

function escapeInlineMarkdown(value) {
  return value.replaceAll('\\', '\\\\').replace(/([*_`[\]])/g, '\\$1')
}

export function exportAnnotationsMarkdown(items, exportedAt = new Date()) {
  const sorted = [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const lines = [
    '# 《自学是门手艺》摘录与批注',
    '',
    `导出时间：${exportedAt.toLocaleString('zh-CN')}`,
    '',
  ]

  for (const item of sorted) {
    lines.push(`## ${escapeInlineMarkdown(item.pageTitle)}`)
    lines.push('')
    for (const line of item.quote.split('\n')) lines.push(`> ${line}`)
    lines.push('')
    if (item.note.trim()) {
      lines.push(item.note.trim())
      lines.push('')
    }
    lines.push(`- 章节：${item.path}`)
    lines.push(`- 创建：${item.createdAt}`)
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}
