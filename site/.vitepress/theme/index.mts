import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AnnotationTools from './components/annotation-tools.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'layout-bottom': () => h(AnnotationTools),
  }),
}
