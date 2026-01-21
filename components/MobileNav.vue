<template>
  <div>
    <!-- Hamburger Menu Button (Mobile Only) -->
    <button
      @click="emit('toggle')"
      class="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all relative z-50"
      :aria-label="isOpen ? 'Cerrar menú' : 'Abrir menú'"
      :aria-expanded="isOpen"
    >
      <div class="hamburger-icon w-5 h-4 relative flex flex-col justify-between">
        <span 
          :class="[
            'block h-0.5 bg-current transition-all duration-300 origin-center',
            isOpen ? 'rotate-45 translate-y-[7px]' : ''
          ]"
        ></span>
        <span 
          :class="[
            'block h-0.5 bg-current transition-all duration-300',
            isOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
          ]"
        ></span>
        <span 
          :class="[
            'block h-0.5 bg-current transition-all duration-300 origin-center',
            isOpen ? '-rotate-45 -translate-y-[7px]' : ''
          ]"
        ></span>
      </div>
    </button>

    <!-- Mobile Menu Overlay -->
    <Transition name="backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        @click="emit('close')"
      ></div>
    </Transition>

    <!-- Mobile Menu Slide-in Panel -->
    <Transition name="slide-in">
      <div
        v-if="isOpen"
        class="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-background border-r border-border-subtle z-50 md:hidden overflow-y-auto"
      >
        <!-- Menu Header -->
        <div class="flex items-center justify-between p-6 border-b border-border-subtle">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center border-2 border-accent/30 shadow-lg shadow-accent/20">
              <span class="text-lg">🎾</span>
            </div>
            <span class="text-size-3 font-semibold text-foreground">
              Tenis Ecuador
            </span>
          </div>
          <button
            @click="emit('close')"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all"
            aria-label="Cerrar menú"
          >
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>

        <!-- Menu Items -->
        <nav class="p-4 space-y-2">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            @click="emit('close')"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-xl text-size-4 font-regular transition-all group',
              item.isActive
                ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
            ]"
          >
            <Icon 
              :name="item.icon" 
              :class="['w-5 h-5 transition-transform', item.isActive ? 'text-accent' : 'group-hover:scale-110']" 
            />
            <span>{{ item.label }}</span>
            <Icon 
              v-if="item.badge && item.badge > 0"
              name="heroicons:bell-alert"
              class="w-4 h-4 ml-auto text-accent"
            />
          </NuxtLink>
        </nav>

        <!-- Menu Footer -->
        <div class="p-4 border-t border-border-subtle mt-4">
          <slot name="footer">
            <SignOutButton>
              <button class="flex items-center gap-3 px-4 py-3 rounded-xl text-size-4 font-regular text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all group w-full">
                <Icon name="heroicons:arrow-right-on-rectangle" class="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Cerrar Sesión</span>
              </button>
            </SignOutButton>
          </slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  currentPath: string
  isOrganizer?: boolean
  notificationCount?: number
}>()

const emit = defineEmits<{
  toggle: []
  close: []
}>()

// Define navigation items
const navItems = computed(() => {
  const items = [
    {
      to: '/',
      label: 'Dashboard',
      icon: 'heroicons:squares-2x2',
      isActive: props.currentPath === '/'
    },
    {
      to: '/matches',
      label: 'Partidos',
      icon: 'heroicons:calendar',
      isActive: props.currentPath.startsWith('/matches')
    },
    {
      to: '/my-ranking',
      label: 'Mi Ranking',
      icon: 'heroicons:chart-bar-square',
      isActive: props.currentPath.startsWith('/my-ranking')
    },
    {
      to: '/leaderboard',
      label: 'Leaderboard',
      icon: 'heroicons:trophy',
      isActive: props.currentPath.startsWith('/leaderboard')
    },
    {
      to: '/tournaments',
      label: 'Torneos',
      icon: 'heroicons:trophy',
      isActive: props.currentPath.startsWith('/tournaments') && !props.currentPath.startsWith('/organizer/tournaments')
    },
    {
      to: '/profile',
      label: 'Mi Perfil',
      icon: 'heroicons:user-circle',
      isActive: props.currentPath.startsWith('/profile')
    }
  ]

  // Add organizer link if user is organizer
  if (props.isOrganizer) {
    items.splice(4, 0, {
      to: '/organizer/tournaments',
      label: 'Mis Torneos',
      icon: 'heroicons:trophy',
      isActive: props.currentPath.startsWith('/organizer/tournaments')
    })
  }

  return items
})

// Close menu when route changes
const route = useRoute()
watch(() => route.path, () => {
  emit('close')
})
</script>

<style scoped>
/* Backdrop transition */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* Slide-in transition */
.slide-in-enter-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-in-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.6, 1);
}

.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(-100%);
}

/* Smooth scrolling in menu */
nav {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-subtle) transparent;
}

nav::-webkit-scrollbar {
  width: 6px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

nav::-webkit-scrollbar-thumb {
  background: var(--color-border-subtle);
  border-radius: 3px;
}

nav::-webkit-scrollbar-thumb:hover {
  background: var(--color-border);
}
</style>
