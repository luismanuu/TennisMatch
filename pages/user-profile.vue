<script setup lang="ts">
import { UserProfile } from '@clerk/vue'

definePageMeta({
  middleware: 'auth'
})

const { isOrganizer } = useOrganizer()
useHead({ title: 'Ajustes · Tenis Ecuador' })
</script>

<template>
  <PageLayout container-size="medium">
    <PageHeader title="Ajustes" subtitle="Tu apariencia, tus accesos y la seguridad de tu cuenta." />

    <div class="flow-stack">
      <section class="panel settings-panel" aria-labelledby="appearance-title">
        <h2 id="appearance-title" class="settings-title">Apariencia</h2>
        <p class="meta">La misma identidad, con la luz que prefieras.</p>
        <ThemeSwitcher class="mt-4" />
        <p class="meta">Geist y verde cancha en ambos modos. Tu elección se guarda en este navegador.</p>
      </section>

      <section aria-labelledby="shortcuts-title">
        <div class="section-heading"><h2 id="shortcuts-title">Accesos</h2></div>
        <div class="list-surface">
          <NuxtLink to="/my-ranking" class="list-row">
            <Icon name="heroicons:chart-bar" class="w-5 h-5 text-accent" aria-hidden="true" />
            <span class="row-copy"><strong>Mi ranking</strong><span class="meta">Tu nivel, historial de SR y posición</span></span>
            <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink v-if="isOrganizer" to="/organizer/tournaments" class="list-row">
            <Icon name="heroicons:trophy" class="w-5 h-5 text-accent" aria-hidden="true" />
            <span class="row-copy"><strong>Mis torneos</strong><span class="meta">Torneos que organizas</span></span>
            <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/creditos" class="list-row">
            <Icon name="heroicons:photo" class="w-5 h-5 text-accent" aria-hidden="true" />
            <span class="row-copy"><strong>Créditos de fotografías</strong><span class="meta">Autores, fuentes y licencias</span></span>
            <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
          </NuxtLink>
          <SignOutButton>
            <button type="button" class="list-row w-full text-left">
              <Icon name="heroicons:arrow-right-on-rectangle" class="w-5 h-5 text-danger" aria-hidden="true" />
              <span class="row-copy"><strong>Cerrar sesión</strong></span>
            </button>
          </SignOutButton>
        </div>
      </section>

      <section aria-labelledby="account-title">
        <div class="section-heading"><h2 id="account-title">Cuenta y seguridad</h2></div>
        <div class="user-profile-page-container">
          <ClientOnly>
            <UserProfile :routing="'hash'" />
            <template #fallback>
              <div class="panel loading-state">
                <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
                <p class="loading-text">Cargando tu cuenta…</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<style scoped>
.settings-panel { display: grid; gap: 8px; }
.settings-title { font-size: 22px; }
.user-profile-page-container { border-radius: var(--radius); overflow: hidden; border: 1px solid var(--edge); }
.user-profile-page-container :deep(.cl-userProfile-root),
.user-profile-page-container :deep(.cl-rootBox),
.user-profile-page-container :deep(.cl-card),
.user-profile-page-container :deep(.cl-cardBox) {
  border-radius: var(--radius) !important;
  width: 100%;
  max-width: 100%;
}
</style>
