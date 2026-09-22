<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'
import {
  annotationsOverlap,
  createAnnotation,
  exportAnnotationsMarkdown,
  loadAnnotations,
  saveAnnotations,
  updateAnnotationNote,
} from '../annotations/model.mjs'
import { applyHighlights, captureSelection } from '../annotations/dom.mjs'

const { site, page } = useData()
const route = useRoute()
const router = useRouter()
const items = ref([])
const panelOpen = ref(false)
const composerOpen = ref(false)
const pendingSelection = ref(null)
const pendingNote = ref('')
const selectionButton = ref(null)
const message = ref('')
const pendingDeleteId = ref('')
const editingId = ref('')
const editingNote = ref('')
const noteInput = ref(null)
let selectionTimer = 0
let messageTimer = 0
let renderedHighlights = new Map()

const currentPath = computed(() => normalizePagePath(route.path))
const currentItems = computed(() => items.value.filter((item) => item.path === currentPath.value))
const sortedItems = computed(() => [...items.value].sort((left, right) => right.createdAt.localeCompare(left.createdAt)))

function normalizePagePath(value) {
  let path = value || '/'
  const base = site.value.base || '/'
  if (base !== '/' && path.startsWith(base)) path = `/${path.slice(base.length)}`
  path = path.replace(/\.html$/, '').replace(/\/$/, '')
  return path || '/'
}

function siteHref(path) {
  const base = (site.value.base || '/').replace(/\/$/, '')
  return `${base}${path}` || '/'
}

function contentRoot() {
  return document.querySelector('.VPDoc .vp-doc')
}

function showMessage(text) {
  message.value = text
  window.clearTimeout(messageTimer)
  messageTimer = window.setTimeout(() => { message.value = '' }, 3200)
}

function persist(nextItems) {
  try {
    items.value = saveAnnotations(window.localStorage, nextItems)
    renderCurrentPage()
    return true
  } catch {
    showMessage('保存失败：浏览器存储空间不可用。')
    return false
  }
}

function renderCurrentPage() {
  const root = contentRoot()
  if (!root) return
  renderedHighlights = applyHighlights(root, currentItems.value)
}

function inspectSelection() {
  if (panelOpen.value || composerOpen.value) return
  const root = contentRoot()
  if (!root) return
  const result = captureSelection(root)
  if (!result.value || !result.rect?.width) {
    selectionButton.value = null
    return
  }
  pendingSelection.value = result.value
  selectionButton.value = {
    top: Math.max(12, result.rect.top - 48),
    left: Math.min(window.innerWidth - 82, Math.max(12, result.rect.left + result.rect.width / 2 - 34)),
  }
}

function scheduleSelectionInspection() {
  window.clearTimeout(selectionTimer)
  selectionTimer = window.setTimeout(inspectSelection, 120)
}

function openComposer() {
  if (!pendingSelection.value) return
  selectionButton.value = null
  composerOpen.value = true
  pendingNote.value = ''
  nextTick(() => noteInput.value?.focus())
}

function closeComposer() {
  composerOpen.value = false
  pendingSelection.value = null
  pendingNote.value = ''
  window.getSelection()?.removeAllRanges()
}

function saveCurrentAnnotation() {
  if (!pendingSelection.value) return
  const annotation = createAnnotation({
    ...pendingSelection.value,
    path: currentPath.value,
    pageTitle: page.value.title || document.title,
    note: pendingNote.value.trim(),
  })
  if (!annotation) return
  if (items.value.some((item) => annotationsOverlap(item, annotation))) {
    showMessage('这段文字与已有摘录重叠。')
    return
  }
  if (persist([...items.value, annotation])) {
    closeComposer()
    showMessage('摘录已保存到当前浏览器。')
  }
}

function requestDelete(id) {
  if (pendingDeleteId.value === id) {
    pendingDeleteId.value = ''
    persist(items.value.filter((item) => item.id !== id))
    showMessage('摘录已删除。')
    return
  }
  pendingDeleteId.value = id
  window.setTimeout(() => {
    if (pendingDeleteId.value === id) pendingDeleteId.value = ''
  }, 3000)
}

function startEdit(item) {
  editingId.value = item.id
  editingNote.value = item.note
}

function cancelEdit() {
  editingId.value = ''
  editingNote.value = ''
}

function saveEdit(id) {
  const nextItems = updateAnnotationNote(items.value, id, editingNote.value)
  if (persist(nextItems)) {
    cancelEdit()
    showMessage('批注已更新。')
  }
}

function clearAll() {
  if (!window.confirm(`确认删除全部 ${items.value.length} 条摘录与批注？此操作无法撤销。`)) return
  if (persist([])) {
    panelOpen.value = false
    showMessage('全部摘录已清除。')
  }
}

function exportMarkdown() {
  if (!items.value.length) return
  const content = exportAnnotationsMarkdown(items.value)
  const blobUrl = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `自学是门手艺-摘录批注-${new Date().toISOString().slice(0, 10)}.md`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
  showMessage('Markdown 文件已导出。')
}

async function goToAnnotation(item) {
  panelOpen.value = false
  if (item.path !== currentPath.value) {
    await router.go(siteHref(item.path))
    await nextTick()
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
    renderCurrentPage()
  }
  const mark = renderedHighlights.get(item.id)
  if (!mark) {
    showMessage('原文位置可能已变化，暂时无法定位。')
    return
  }
  mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
  mark.classList.add('reader-highlight-focus')
  window.setTimeout(() => mark.classList.remove('reader-highlight-focus'), 1600)
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (composerOpen.value) closeComposer()
  else if (panelOpen.value) panelOpen.value = false
}

function handleScroll() {
  selectionButton.value = null
}

watch(() => route.path, async () => {
  selectionButton.value = null
  await nextTick()
  window.requestAnimationFrame(renderCurrentPage)
})

onMounted(() => {
  items.value = loadAnnotations(window.localStorage)
  document.addEventListener('selectionchange', scheduleSelectionInspection)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.requestAnimationFrame(renderCurrentPage)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', scheduleSelectionInspection)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', handleScroll)
  window.clearTimeout(selectionTimer)
  window.clearTimeout(messageTimer)
})
</script>

<template>
  <Teleport to="body">
    <button
      v-if="selectionButton"
      class="selection-action"
      :style="{ top: `${selectionButton.top}px`, left: `${selectionButton.left}px` }"
      type="button"
      @click="openComposer"
    >
      摘录
    </button>

    <button
      class="annotation-launcher"
      type="button"
      :aria-label="`摘录与批注，共 ${items.length} 条`"
      @click="panelOpen = true"
    >
      <span aria-hidden="true">✎</span>
      <span class="annotation-launcher-label">摘录与批注</span>
      <span v-if="items.length" class="annotation-count">{{ items.length }}</span>
    </button>

    <div v-if="composerOpen" class="annotation-backdrop" @click.self="closeComposer">
      <section class="annotation-composer" role="dialog" aria-modal="true" aria-labelledby="annotation-compose-title">
        <header>
          <h2 id="annotation-compose-title">保存摘录</h2>
          <button type="button" aria-label="关闭" @click="closeComposer">×</button>
        </header>
        <blockquote>{{ pendingSelection?.quote }}</blockquote>
        <label for="annotation-note">批注（可选）</label>
        <textarea
          id="annotation-note"
          ref="noteInput"
          v-model="pendingNote"
          maxlength="10000"
          rows="5"
          placeholder="写下你的想法、疑问或行动……"
        />
        <footer>
          <button class="annotation-secondary" type="button" @click="closeComposer">取消</button>
          <button class="annotation-primary" type="button" @click="saveCurrentAnnotation">保存</button>
        </footer>
      </section>
    </div>

    <div v-if="panelOpen" class="annotation-backdrop annotation-panel-backdrop" @click.self="panelOpen = false">
      <aside class="annotation-panel" role="dialog" aria-modal="true" aria-labelledby="annotation-panel-title">
        <header>
          <div>
            <h2 id="annotation-panel-title">摘录与批注</h2>
            <p>仅保存在当前浏览器</p>
          </div>
          <button type="button" aria-label="关闭" @click="panelOpen = false">×</button>
        </header>

        <div v-if="items.length" class="annotation-panel-actions">
          <button type="button" @click="exportMarkdown">导出 Markdown</button>
          <button class="annotation-danger" type="button" @click="clearAll">清空全部</button>
        </div>

        <div v-if="!items.length" class="annotation-empty">
          <span aria-hidden="true">✦</span>
          <h3>还没有摘录</h3>
          <p>关闭面板，在正文中选择一段文字即可开始。</p>
        </div>

        <ol v-else class="annotation-list">
          <li v-for="item in sortedItems" :key="item.id">
            <button v-if="editingId !== item.id" class="annotation-card" type="button" @click="goToAnnotation(item)">
              <span class="annotation-page">{{ item.pageTitle }}</span>
              <q>{{ item.quote }}</q>
              <span v-if="item.note" class="annotation-note">{{ item.note }}</span>
              <time :datetime="item.createdAt">{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</time>
            </button>
            <div v-else class="annotation-edit-form">
              <span class="annotation-page">{{ item.pageTitle }}</span>
              <q>{{ item.quote }}</q>
              <label :for="`edit-note-${item.id}`">修改批注</label>
              <textarea :id="`edit-note-${item.id}`" v-model="editingNote" maxlength="10000" rows="4" />
              <div>
                <button type="button" @click="cancelEdit">取消</button>
                <button class="annotation-primary" type="button" @click="saveEdit(item.id)">保存</button>
              </div>
            </div>
            <div v-if="editingId !== item.id" class="annotation-item-actions">
              <button type="button" @click="startEdit(item)">编辑</button>
              <button class="annotation-delete" type="button" @click="requestDelete(item.id)">
                {{ pendingDeleteId === item.id ? '确认删除' : '删除' }}
              </button>
            </div>
          </li>
        </ol>
      </aside>
    </div>

    <div v-if="message" class="annotation-toast" role="status">{{ message }}</div>
  </Teleport>
</template>
