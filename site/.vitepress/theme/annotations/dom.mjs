import { findQuoteOffset } from './model.mjs'

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, td, th'

export function getAnnotationBlocks(root) {
  return [...root.querySelectorAll(BLOCK_SELECTOR)]
}

function closestBlock(node, root) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
  const block = element?.closest(BLOCK_SELECTOR)
  return block && root.contains(block) ? block : null
}

export function captureSelection(root) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return { error: '请先选择一段文字。' }
  }

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return { error: '只能摘录正文中的文字。' }
  }
  if (range.startContainer.parentElement?.closest('mark.reader-highlight')) {
    return { error: '这段文字已经被摘录。' }
  }

  const startBlock = closestBlock(range.startContainer, root)
  const endBlock = closestBlock(range.endContainer, root)
  if (!startBlock || startBlock !== endBlock) {
    return { error: '请在同一个段落内选择文字。' }
  }

  const quote = range.toString()
  if (!quote.trim()) return { error: '请选择包含文字的内容。' }
  if (quote.length > 4000) return { error: '单条摘录不能超过 4000 个字符。' }

  const beforeRange = document.createRange()
  beforeRange.selectNodeContents(startBlock)
  beforeRange.setEnd(range.startContainer, range.startOffset)
  const quoteStart = beforeRange.toString().length
  const blockText = startBlock.textContent || ''
  const blocks = getAnnotationBlocks(root)

  return {
    value: {
      quote,
      blockIndex: blocks.indexOf(startBlock),
      quoteStart,
      prefix: blockText.slice(Math.max(0, quoteStart - 48), quoteStart),
      suffix: blockText.slice(quoteStart + quote.length, quoteStart + quote.length + 48),
    },
    rect: range.getBoundingClientRect(),
  }
}

function textRangeForOffsets(block, start, end) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let cursor = 0
  let startNode = null
  let startOffset = 0
  let endNode = null
  let endOffset = 0

  while (walker.nextNode()) {
    const node = walker.currentNode
    const nextCursor = cursor + node.data.length
    if (!startNode && start >= cursor && start <= nextCursor) {
      startNode = node
      startOffset = start - cursor
    }
    if (end >= cursor && end <= nextCursor) {
      endNode = node
      endOffset = end - cursor
      break
    }
    cursor = nextCursor
  }

  if (!startNode || !endNode) return null
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

export function clearHighlights(root) {
  for (const mark of root.querySelectorAll('mark.reader-highlight')) {
    const parent = mark.parentNode
    mark.replaceWith(...mark.childNodes)
    parent?.normalize()
  }
}

export function applyHighlights(root, annotations) {
  clearHighlights(root)
  const blocks = getAnnotationBlocks(root)
  const located = []

  for (const annotation of annotations) {
    const preferredBlock = blocks[annotation.blockIndex]
    let block = preferredBlock
    let start = block ? findQuoteOffset(block.textContent || '', annotation) : -1

    if (start === -1) {
      block = blocks.find((candidate) => (candidate.textContent || '').includes(annotation.quote))
      start = block ? findQuoteOffset(block.textContent || '', annotation) : -1
    }
    if (!block || start === -1) continue
    located.push({ annotation, block, start })
  }

  located.sort((left, right) => {
    if (left.block === right.block) return right.start - left.start
    return blocks.indexOf(right.block) - blocks.indexOf(left.block)
  })

  const rendered = new Map()
  for (const item of located) {
    const range = textRangeForOffsets(
      item.block,
      item.start,
      item.start + item.annotation.quote.length,
    )
    if (!range) continue
    const mark = document.createElement('mark')
    mark.className = 'reader-highlight'
    mark.dataset.annotationId = item.annotation.id
    mark.append(range.extractContents())
    range.insertNode(mark)
    rendered.set(item.annotation.id, mark)
  }

  return rendered
}
