import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { mdiMagnify, mdiSchool, mdiChevronRight } from '@mdi/js'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      magnify: mdiMagnify,
      school: mdiSchool,
      chevronRight: mdiChevronRight,
    },
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#4285f4',
          secondary: '#1565c0',
        },
      },
    },
  },
})
