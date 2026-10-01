import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'
import ReaderView from '../views/ReaderView.vue'
import HomeView from '../views/HomeView.vue'

export function createAppRouter(
  history: RouterHistory = createWebHashHistory(import.meta.env.BASE_URL),
) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/app', name: 'reader', component: ReaderView },
      { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
  })
}
