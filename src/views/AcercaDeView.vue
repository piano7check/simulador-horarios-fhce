<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <v-container class="py-8">
    <v-card elevation="2" class="mx-auto" max-width="900">
      <v-card-title class="text-h5">Acerca de</v-card-title>
      <v-card-text>
        <div class="mb-6">
          <div class="text-subtitle-1 font-weight-medium mb-2">¿Qué es Simulador de Horarios FHCE?</div>
          <p>
            Simulador de Horarios FHCE está basado en el proyecto Capuchino original proporcionado por la
            SECI (FCyT - UMSS). Al igual que ese proyecto, este simulador es Open Source. El código
            fuente está disponible en:
            <a
              href="https://github.com/piano7check/simulador-horarios-fhce"
              target="_blank"
              rel="noopener"
              >github.com/piano7check/simulador-horarios-fhce</a
            >.
          </p>
        </div>

        <div class="mb-6">
          <div class="text-subtitle-1 font-weight-medium mb-2">También conocido como</div>
          <p>
            Esta herramienta puede aparecer referida como "Simulador de Horarios FHCE", "Simulador de Horarios",
            "Planificador de Horarios UMSS", "Horario UMSS", "Capuchino Horarios", "Cappuccino UMSS"
            "Cappuchino UMSS" o "Planificador de clases". Estas variantes ayudan a que la aplicación
            sea encontrada por estudiantes que usan diferentes términos para buscar soluciones de
            organización de horarios.
          </p>
        </div>

        <div class="mb-6">
          <div class="text-subtitle-1 font-weight-medium mb-2">Cómo usarlo</div>
          <ol>
            <li>
              Selecciona tu carrera desde la pantalla principal (si ya iniciaste sesión y tienes
              un horario guardado, se abre directo, sin pasar por este paso).
            </li>
            <li>
              Expande el semestre con las materias que quieres cursar, o usa el buscador para
              encontrar una materia o un docente por nombre.
            </li>
            <li>
              Selecciona el grupo que te interesa de cada materia. El calendario mostrará los
              choques en rojo.
            </li>
            <li>
              Toca una materia en el horario para ver más información (docente, aula, aula
              virtual, grupo de WhatsApp) o quitarla con el botón "Quitar materia".
            </li>
            <li>¿Tienes un choque? Prueba con otro grupo de alguna materia involucrada.</li>
            <li>Imprime tu horario, o descárgalo como PDF o como imagen.</li>
          </ol>
          <p class="mt-3">
            Con sesión iniciada, tu horario se guarda solo, en la nube, apenas agregás o quitás
            una materia — no hace falta guardarlo a mano. Sin sesión, podés guardarlo
            manualmente, lo que te pedirá registrarte primero.
          </p>
          <p class="mt-2">
            Usos habituales: preparar tu horario antes de registrar materias en WEBSIS, compartir
            tu horario con compañeros o imprimirlo para tenerlo a mano.
          </p>
        </div>

        <div class="mb-6">
          <div class="text-subtitle-1 font-weight-medium mb-2">Créditos y contacto</div>
          <p>
            Este proyecto está basado en el trabajo original de Kusillo (Pedro Carpio), autor del
            proyecto Capuchino. Esta versión, Simulador de Horarios FHCE, es mantenida y ampliada
            por el Ing. Gustavo Rojas Valdivia, quien incorporó, entre otras mejoras, el guardado
            de horarios de cada estudiante en base de datos para poder recuperarlos más adelante.
          </p>
          <p class="mt-2">
            Si encuentras un bug o tienes una sugerencia, por favor abre un issue o envía un pull
            request en el repositorio, o contacta directamente:<br />
            WhatsApp: <a href="https://wa.me/59177435817" target="_blank" rel="noopener">77435817</a><br />
            Email: <a href="mailto:grv.trainer@gmail.com">grv.trainer@gmail.com</a>
          </p>
        </div>

        <div class="mb-6">
          <div class="text-subtitle-1 font-weight-medium mb-2">Licencia y participación</div>
          <p>
            Este proyecto es Open Source. Revisa el repositorio para detalles sobre la licencia y
            cómo contribuir. Agradezco las contribuciones, correcciones y reportes de problemas.
          </p>
        </div>

        <div class="d-flex justify-end">
          <v-btn color="primary" variant="tonal" @click="router.push({ name: 'inicio' })"
            >Simular horarios</v-btn
          >
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
:root {
  --max-width: 900px;
}
v-card {
  padding: 16px;
}
ol {
  margin-left: 1rem;
}
</style>
