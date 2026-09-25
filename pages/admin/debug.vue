<template>
  <PageLayout container-size="medium">
    <div class="flow-stack">
      <PageHeader title="Admin debug" subtitle="Tu sesión y la verificación de rol en el servidor." />

      <div class="panel">
        <h2 class="panel-title">Sesión</h2>
        <pre class="debug-pre">{{ JSON.stringify({ isLoaded, isAuthenticated, user }, null, 2) }}</pre>
      </div>

      <div class="panel">
        <h2 class="panel-title">Verificación de rol</h2>
        <div class="space-y-2">
          <p><strong>Rol en la sesión:</strong> {{ role ?? 'sin sesión' }}</p>
          <p><strong>Admin según el servidor:</strong> {{ serverIsAdmin === null ? '—' : serverIsAdmin }}</p>
          <p v-if="serverError" class="form-error">{{ serverError }}</p>
        </div>
      </div>

      <div class="panel">
        <button type="button" class="btn-secondary" @click="checkServerAdmin">Consultar al servidor</button>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const { isLoaded, isAuthenticated, user, role } = useAuthState()
const serverIsAdmin = ref<boolean | null>(null)
const serverError = ref('')

async function checkServerAdmin() {
  serverError.value = ''
  try {
    const result = await $fetch<{ isAdmin: boolean }>('/api/admin/check')
    serverIsAdmin.value = result.isAdmin
  } catch (error: any) {
    if (error?.statusCode === 403) {
      serverIsAdmin.value = false
      return
    }
    serverIsAdmin.value = null
    serverError.value = error?.data?.statusMessage || 'No se pudo consultar el servidor.'
  }
}
</script>

<style scoped>
.debug-pre { padding: 16px; border-radius: 14px; background: var(--background); border: 1px solid var(--edge); font-family: var(--font-mono); font-size: 13px; overflow: auto; }
</style>
