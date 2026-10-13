import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createAppRouter } from './router'
import { useThemeStore } from './stores/theme'
import { connectTheme } from './services/theme-runtime'
import { startupScreen } from './services/startup-screen'
import './assets/main.css'

export async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  const stopTheme = connectTheme(useThemeStore(pinia))
  const router = createAppRouter()
  app.use(router)
  await router.isReady()
  startupScreen.complete('route')
  app.mount('#app')
  await nextTick()
  // ReaderView signals readiness after saved metadata has been checked.
  if (router.currentRoute.value.name !== 'reader') {
    startupScreen.complete('library')
    startupScreen.ready()
  }
  if (import.meta.hot) import.meta.hot.dispose(stopTheme)
}
