<template>
  <ClientOnly>
    <header class="nav-island">
      <NuxtLink to="/" class="brand" aria-label="Tenis Ecuador, inicio">
        <BrandMark />
        <span>Tenis <strong>Ecuador</strong></span>
      </NuxtLink>

      <nav v-if="isAuthenticated" class="nav-links" aria-label="Principal">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :aria-current="item.active ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="nav-tools" :class="{ 'ml-auto': !isAuthenticated }">
        <template v-if="isAuthenticated">
          <button
            type="button"
            class="icon-button"
            :aria-label="unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'"
            :aria-expanded="notificationDropdownOpen"
            @click.stop="notificationDropdownOpen = !notificationDropdownOpen"
          >
            <Icon :name="unreadCount > 0 ? 'heroicons:bell-alert' : 'heroicons:bell'" class="w-[22px] h-[22px]" />
            <span v-if="unreadCount > 0" class="nav-dot" aria-hidden="true"></span>
          </button>
          <NotificationDropdown
            :is-open="notificationDropdownOpen"
            :notifications="notifications || []"
            :unread-count="unreadCount || 0"
            :count="count"
            :loading="loading"
            @close="notificationDropdownOpen = false"
            @mark-as-read="markAsRead"
            @dismiss="dismiss"
            @mark-all-read="markAllRead"
          />
          <NuxtLink
            to="/user-profile"
            class="icon-button"
            aria-label="Ajustes"
            :aria-current="route.path.startsWith('/user-profile') ? 'page' : undefined"
          >
            <Icon name="heroicons:adjustments-horizontal" class="w-[22px] h-[22px]" />
          </NuxtLink>
        </template>
        <template v-else-if="authLoaded">
          <NuxtLink to="/sign-in" class="text-link px-2">Iniciar sesión</NuxtLink>
          <NuxtLink to="/sign-up" class="btn-primary !min-h-[44px] !py-2">Crear cuenta</NuxtLink>
        </template>
      </div>
    </header>
    <template #fallback>
      <header class="nav-island">
        <NuxtLink to="/" class="brand" aria-label="Tenis Ecuador, inicio">
          <BrandMark />
          <span>Tenis <strong>Ecuador</strong></span>
        </NuxtLink>
      </header>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
/**
 * Floating top island (DESIGN.md §6): brand + labeled destinations from 900px,
 * brand + notifications + settings below it (the BottomTabBar carries the tabs).
 */
const { isAuthenticated, authLoaded } = useAuthState()
const { isOrganizer } = useOrganizer()
const route = useRoute()

const {
  notifications,
  unreadCount,
  count,
  loading,
  markAsRead,
  dismiss,
  markAllRead,
  fetchNotifications
} = useNotifications()

const notificationDropdownOpen = ref(false)

watch(notificationDropdownOpen, (isOpen) => {
  if (isOpen) fetchNotifications()
})

const navItems = computed(() => {
  const p = route.path
  const items = [
    { to: '/', label: 'Inicio', active: p === '/' },
    { to: '/matches', label: 'Partidos', active: p.startsWith('/matches') || p.startsWith('/matchmaking') },
    { to: '/leaderboard', label: 'Ranking', active: p.startsWith('/leaderboard') || p.startsWith('/my-ranking') },
    { to: '/tournaments', label: 'Torneos', active: p.startsWith('/tournaments') },
    { to: '/profile', label: 'Perfil', active: p.startsWith('/profile') }
  ]
  if (isOrganizer.value) {
    items.splice(4, 0, { to: '/organizer/tournaments', label: 'Mis torneos', active: p.startsWith('/organizer') })
  }
  return items
})
</script>
