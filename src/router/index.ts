import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'inicio',
      component: () => import('@/views/InicioView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
    },
    {
      path: '/:carrera',
      name: 'planificador',
      component: () => import('@/views/PlanificadorView.vue'),
    },
    {
      path: '/acerca-de',
      name: 'acerca',
      component: () => import('@/views/AcercaDeView.vue'),
    },
  ],
})

// Los archivos de cada vista se cargan bajo demanda con un nombre único
// por build (ej. "InicioView-Ihu0y47-.js"). Si el navegador tenía la app
// abierta desde antes de un despliegue nuevo, ese archivo ya no existe en
// el servidor — Vercel devuelve la página principal en su lugar, y el
// navegador rechaza el módulo por no ser JS de verdad. En vez de dejar la
// app rota, se detecta ese error puntual y se recarga la página, trayendo
// la versión actual.
router.onError((error) => {
  const mensaje = error?.message ?? ''
  const esModuloDesactualizado =
    /Failed to fetch dynamically imported module/i.test(mensaje) ||
    /error loading dynamically imported module/i.test(mensaje) ||
    /Importing a module script failed/i.test(mensaje)
  if (esModuloDesactualizado) window.location.reload()
})

export default router
