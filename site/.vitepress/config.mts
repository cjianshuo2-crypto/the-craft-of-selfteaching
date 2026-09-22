import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'

type SourceSection = {
  text: string
  items: Array<{ text: string; file: string }>
}

const sidebarPath = fileURLToPath(new URL('../book/sidebar.json', import.meta.url))
const sourceSections = JSON.parse(readFileSync(sidebarPath, 'utf8')) as SourceSection[]
const sidebar = sourceSections.map((section) => ({
  text: section.text,
  collapsed: section.text !== '自学是门艺术',
  items: section.items.map((item) => ({
    text: item.text,
    link: `/book/${item.file.replace(/\.md$/, '')}`,
  })),
}))

export default defineConfig({
  lang: 'zh-CN',
  title: '自学是门手艺',
  description: '李笑来《自学是门手艺》非商业在线阅读版',
  base: process.env.SITE_BASE || '/the-craft-of-selfteaching/',
  cleanUrls: true,
  ignoreDeadLinks: [/^http:\/\/localhost:/],
  lastUpdated: false,
  markdown: {
    lineNumbers: true,
    image: { lazyLoading: true },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#b45309' }],
    ['meta', { name: 'referrer', content: 'strict-origin-when-cross-origin' }],
  ],
  themeConfig: {
    logo: '/book-mark.svg',
    nav: [
      { text: '首页', link: '/' },
      { text: '开始阅读', link: '/book/01.preface' },
      { text: '原仓库', link: 'https://github.com/xiaolai/the-craft-of-selfteaching' },
    ],
    sidebar: { '/book/': sidebar },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除查询',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xiaolai/the-craft-of-selfteaching' },
    ],
    footer: {
      message: '正文版权归原作者所有 · CC BY-NC-ND · 非商业阅读站',
      copyright: 'Website source maintained separately from the original text.',
    },
  },
})
