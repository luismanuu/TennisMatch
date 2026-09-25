<template>
  <ClientOnly>
    <nav
      v-if="isAuthenticated"
      class="tabbar"
      aria-label="Principal móvil"
    >
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="tabbar-item"
        :class="{ 'is-active': tab.active }"
        :aria-current="tab.active ? 'page' : undefined"
      >
        <span class="tabbar-icon">
          <Icon :name="tab.icon" class="w-[22px] h-[22px]" />
          <span v-if="tab.badge" class="tabbar-badge" aria-hidden="true"></span>
        </span>
        <span class="tabbar-label">{{ tab.label }}</span>
      </NuxtLink>
    </nav>
  </ClientOnly>
</template>

<script setup lang="ts">
/**
 * Mobile tab island (DESIGN.md §6): five labeled destinations below 900px.
 * Secondary destinations (organizer, appearance, sign out) live in Ajustes.
 */
const route = useRoute()
const { isAuthenticated } = useAuthState()
const { unreadCount } = useNotifications()

const tabs = computed(() => [
  { to: '/', label: 'Inicio', icon: 'heroicons:home', active: route.path === '/' },
  { to: '/matches', label: 'Partidos', icon: 'heroicons:calendar-days', active: route.path.startsWith('/matches') || route.path.startsWith('/matchmaking'), badge: (unreadCount?.value ?? 0) > 0 },
  { to: '/leaderboard', label: 'Ranking', icon: 'heroicons:chart-bar', active: route.path.startsWith('/leaderboard') || route.path.startsWith('/my-ranking') },
  { to: '/tournaments', label: 'Torneos', icon: 'heroicons:trophy', active: route.path.startsWith('/tournaments') || route.path.startsWith('/organizer') },
  { to: '/profile', label: 'Perfil', icon: 'heroicons:user', active: route.path.startsWith('/profile') || route.path.startsWith('/user-profile') }
])
</script>
