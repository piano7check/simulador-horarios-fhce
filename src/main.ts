import { createApp } from 'vue'
import { inject } from '@vercel/analytics'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'

inject()

// Con despliegues seguidos, una pestaña abierta desde antes de un deploy
// nuevo puede intentar cargar CUALQUIER chunk con hash de la build vieja
// (no solo el de una vista/ruta — puede ser un componente interno como
// VContainer de Vuetify), que ya no existe en el servidor. Vite emite este
// evento específicamente para ese caso; se recarga la página para traer
// la versión actual en vez de dejar la app rota. Complementa el
// router.onError de src/router/index.ts, que solo cubre los chunks de
// rutas cargadas por el router.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

const app = createApp(App)

app.use(router)
app.use(vuetify)

app.mount('#app')
