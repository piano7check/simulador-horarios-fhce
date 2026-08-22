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

const app = createApp(App)

app.use(router)
app.use(vuetify)

app.mount('#app')
