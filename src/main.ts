import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createAppRouter } from './router'
import { useThemeStore } from './stores/theme'
import { connectTheme } from './services/theme-runtime'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const stopTheme = connectTheme(useThemeStore(pinia))
app.use(createAppRouter())
app.mount('#app')
if (import.meta.hot) import.meta.hot.dispose(stopTheme)
