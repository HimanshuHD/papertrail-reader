import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

export function createAppRouter(
  history: RouterHistory = createWebHashHistory(import.meta.env.BASE_URL),
) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
  })
}
