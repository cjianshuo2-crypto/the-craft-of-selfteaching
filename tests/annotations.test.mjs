import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANNOTATION_STORAGE_KEY,
  annotationsOverlap,
  exportAnnotationsMarkdown,
  findQuoteOffset,
  loadAnnotations,
  normalizeAnnotation,
  saveAnnotations,
  updateAnnotationNote,
} from '../site/.vitepress/theme/annotations/model.mjs'

const sample = {
  id: 'note-1',
  path: '/book/01.preface',
  pageTitle: '前言',
  quote: '自学能力',
  note: '重要概念',
  blockIndex: 3,
  quoteStart: 4,
  prefix: '掌握',
  suffix: '非常重要',
  createdAt: '2026-09-22T00:00:00.000Z',
}

function memoryStorage(initialValue = null) {
  let value = initialValue
  return {
    getItem(key) {
      assert.equal(key, ANNOTATION_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, ANNOTATION_STORAGE_KEY)
      value = nextValue
    },
    value: () => value,
  }
}

test('annotation data is normalized and bounded', () => {
  assert.deepEqual(normalizeAnnotation(sample), sample)
  assert.equal(normalizeAnnotation({ ...sample, path: 'not-a-route' }), null)
  assert.equal(normalizeAnnotation({ ...sample, quote: '' }), null)
  assert.equal(normalizeAnnotation(null), null)
})

test('annotation storage is versioned and tolerates invalid data', () => {
  const storage = memoryStorage()
  saveAnnotations(storage, [sample])
  assert.deepEqual(loadAnnotations(storage), [sample])
  assert.deepEqual(loadAnnotations(memoryStorage('{broken')), [])
  assert.deepEqual(loadAnnotations(memoryStorage('{"version":2,"items":[]}')), [])
})

test('quote anchoring prefers exact and contextual matches', () => {
  assert.equal(findQuoteOffset('掌握自学能力非常重要', sample), 2)
  const repeated = { ...sample, quoteStart: 99, prefix: '再次', suffix: '出现' }
  assert.equal(findQuoteOffset('自学能力最初。再次自学能力出现。', repeated), 9)
  assert.equal(findQuoteOffset('内容已经改变', sample), -1)
})

test('overlap detection is limited to the same page and block', () => {
  assert.equal(annotationsOverlap(sample, { ...sample, id: 'note-2', quoteStart: 6 }), true)
  assert.equal(annotationsOverlap(sample, { ...sample, id: 'note-3', quoteStart: 20 }), false)
  assert.equal(annotationsOverlap(sample, { ...sample, id: 'note-4', path: '/book/other' }), false)
})

test('notes can be edited without changing the excerpt anchor', () => {
  const [updated] = updateAnnotationNote([sample], sample.id, '  新的批注  ')
  assert.equal(updated.note, '新的批注')
  assert.equal(updated.quote, sample.quote)
  assert.equal(updated.quoteStart, sample.quoteStart)
})

test('Markdown export contains source context and notes', () => {
  const output = exportAnnotationsMarkdown([sample], new Date('2026-09-22T08:00:00Z'))
  assert.match(output, /# 《自学是门手艺》摘录与批注/)
  assert.match(output, /> 自学能力/)
  assert.match(output, /重要概念/)
  assert.match(output, /\/book\/01\.preface/)
})
