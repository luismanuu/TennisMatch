# Tenis Ecuador - Design System Guide

## 🎨 Silicon Valley Top-Tier Design System

This document provides a comprehensive guide to using the design system for creating new pages and components that automatically inherit the premium Silicon Valley aesthetic.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Page Layouts](#page-layouts)
3. [Components](#components)
4. [Styling Utilities](#styling-utilities)
5. [Animations](#animations)
6. [Color System](#color-system)
7. [Best Practices](#best-practices)

---

## 🚀 Quick Start

### Creating a New Page

The easiest way to create a new page with the Silicon Valley design is to use the `PageLayout` component:

```vue
<template>
  <PageLayout container-size="medium">
    <PageHeader
      title="Mi Nueva Página"
      subtitle="Descripción de la página"
      badge="Nuevo"
      badge-icon="heroicons:sparkles"
    />

    <!-- Your content here -->
    <div class="glass-card-elevated p-6 animate-fade-up animate-delay-1">
      <h2 class="text-size-2 font-semibold text-foreground mb-4">Contenido</h2>
      <p class="text-size-4 text-foreground-muted">Tu contenido aquí...</p>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
// Your script here
</script>
```

### Manual Page Setup

If you prefer to set up the page manually:

```vue
<template>
  <div class="min-h-screen bg-background relative overflow-hidden">
    <!-- Ambient Background Effects -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="orb orb-accent w-96 h-96 -top-48 -right-48 animate-float opacity-20"></div>
      <div class="orb orb-secondary w-80 h-80 -bottom-40 -left-40 animate-float-delayed opacity-15"></div>
      <div class="grid-pattern absolute inset-0 opacity-30"></div>
    </div>

    <!-- Navigation -->
    <AppNavigation />
    
    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Your content here -->
      </div>
    </div>
  </div>
</template>
```

---

## 📐 Page Layouts

### PageLayout Component

The `PageLayout` component provides a consistent page structure with ambient background effects and navigation.

**Props:**
- `containerSize`: `'narrow' | 'medium' | 'wide'` (default: `'medium'`)

**Usage:**
```vue
<PageLayout container-size="medium">
  <!-- Your content -->
</PageLayout>
```

### PageHeader Component

The `PageHeader` component provides consistent page headers with optional badges, back links, and action buttons.

**Props:**
- `title`: string (required) - Page title
- `subtitle`: string (optional) - Page subtitle
- `badge`: string (optional) - Badge text
- `badgeIcon`: string (optional) - Heroicon name for badge
- `backTo`: string (optional) - Route for back link
- `backLabel`: string (optional) - Back link label (default: "Volver")
- `layout`: `'centered' | 'split'` (default: `'centered'`) - Header layout

**Slots:**
- `actions` - Action buttons (shown on the right in split layout)

**Usage:**
```vue
<PageHeader
  title="Mi Página"
  subtitle="Descripción"
  badge="Nuevo"
  badge-icon="heroicons:sparkles"
  back-to="/previous-page"
  back-label="Volver"
  layout="split"
>
  <template #actions>
    <button class="btn-primary">
      <Icon name="heroicons:plus" class="w-4 h-4" />
      Nueva Acción
    </button>
  </template>
</PageHeader>
```

---

## 🧩 Components

### Glass Cards

Use glass morphism cards for elevated content:

```vue
<!-- Standard glass card -->
<div class="glass-card p-6">
  <!-- Content -->
</div>

<!-- Elevated glass card (with shadow) -->
<div class="glass-card-elevated p-6 hover-lift">
  <!-- Content -->
</div>
```

### Buttons

Use the standardized button classes:

```vue
<!-- Primary button -->
<button class="btn-primary">
  <Icon name="heroicons:plus" class="w-4 h-4" />
  Primary Action
</button>

<!-- Secondary button -->
<button class="btn-secondary">
  Secondary Action
</button>

<!-- Danger button -->
<button class="btn-danger">
  Delete
</button>
```

### Form Inputs

Use standardized form input classes:

```vue
<label class="form-label">Nombre</label>
<input
  v-model="name"
  type="text"
  class="form-input"
  placeholder="Ingresa tu nombre"
/>

<label class="form-label">Categoría</label>
<select v-model="category" class="form-select">
  <option value="">Selecciona...</option>
</select>

<label class="form-label">Descripción</label>
<textarea
  v-model="description"
  class="form-textarea"
  rows="3"
></textarea>
```

### Status Badges

Use standardized status badges:

```vue
<span class="status-badge status-badge-upcoming">Próximo</span>
<span class="status-badge status-badge-active">Activo</span>
<span class="status-badge status-badge-completed">Completado</span>
<span class="status-badge status-badge-pending">Pendiente</span>
```

### Loading States

Use the standardized loading state:

```vue
<div v-if="loading" class="loading-state">
  <Icon name="heroicons:arrow-path" class="loading-spinner" />
  <p class="loading-text">Cargando...</p>
</div>
```

### Empty States

Use the standardized empty state:

```vue
<div v-if="items.length === 0" class="empty-state">
  <Icon name="heroicons:inbox" class="empty-state-icon" />
  <h3 class="empty-state-title">No hay elementos</h3>
  <p class="empty-state-description">
    Crea tu primer elemento para comenzar
  </p>
  <button class="btn-primary">Crear Elemento</button>
</div>
```

### Statistics Cards

Use standardized stat cards:

```vue
<div class="stat-card stat-card-blue">
  <div class="stat-card-label">
    <Icon name="heroicons:users" class="w-5 h-5" />
    <span>Total Usuarios</span>
  </div>
  <p class="stat-card-value text-blue-400">1,234</p>
</div>

<div class="stat-card stat-card-green">
  <!-- Green stat card -->
</div>

<div class="stat-card stat-card-purple">
  <!-- Purple stat card -->
</div>

<div class="stat-card stat-card-yellow">
  <!-- Yellow stat card -->
</div>
```

---

## 🎨 Styling Utilities

### Text Sizes

```vue
<p class="text-size-1">Large Heading (40px)</p>
<p class="text-size-2">Subheading (24px)</p>
<p class="text-size-3">Body Text (16px)</p>
<p class="text-size-4">Small Text (14px)</p>
```

### Font Weights

```vue
<p class="font-regular">Regular (400)</p>
<p class="font-semibold">Semibold (600)</p>
```

### Colors

```vue
<p class="text-foreground">Primary Text</p>
<p class="text-foreground-muted">Secondary Text</p>
<p class="text-foreground-subtle">Tertiary Text</p>
<p class="text-accent">Accent Color</p>

<div class="bg-background">Background</div>
<div class="bg-surface">Surface</div>
<div class="bg-surface-elevated">Elevated Surface</div>
```

### Containers

```vue
<div class="container-narrow">Narrow (672px)</div>
<div class="container-medium">Medium (896px)</div>
<div class="container-wide">Wide (1280px)</div>
```

---

## ✨ Animations

### Entrance Animations

```vue
<!-- Fade up with delay -->
<div class="animate-fade-up animate-delay-1">Content</div>
<div class="animate-fade-up animate-delay-2">Content</div>
<div class="animate-fade-up animate-delay-3">Content</div>

<!-- Fade in scale -->
<div class="animate-fade-in-scale">Content</div>

<!-- Slide animations -->
<div class="animate-slide-left">Content</div>
<div class="animate-slide-right">Content</div>
```

### Hover Effects

```vue
<!-- Lift on hover -->
<div class="hover-lift">Card</div>

<!-- Scale on hover -->
<div class="hover-scale">Element</div>

<!-- Glow on hover -->
<div class="hover-glow">Button</div>

<!-- Border glow on hover -->
<div class="hover-border-glow">Input</div>
```

### Available Delays

- `animate-delay-1` - 0.1s
- `animate-delay-2` - 0.2s
- `animate-delay-3` - 0.3s
- `animate-delay-4` - 0.4s
- `animate-delay-5` - 0.5s
- `animate-delay-6` - 0.6s

---

## 🎨 Color System

The design system uses OKLCH color format for better color consistency and accessibility.

### Color Variables

All colors are defined in `assets/css/design-system.css`:

- `--background`: Main background
- `--background-subtle`: Slightly lighter background
- `--surface`: Card/surface background
- `--surface-elevated`: Elevated surfaces
- `--foreground`: Primary text
- `--foreground-muted`: Secondary text
- `--foreground-subtle`: Tertiary text
- `--accent`: Primary accent color (green/teal)
- `--accent-subtle`: Accent with opacity
- `--accent-secondary`: Secondary accent (blue)
- `--border`: Primary border
- `--border-subtle`: Subtle border
- `--border-muted`: Muted border

---

## ✅ Best Practices

### 1. Always Use PageLayout

For new pages, always use the `PageLayout` component to ensure consistency:

```vue
<PageLayout>
  <!-- Your content -->
</PageLayout>
```

### 2. Use PageHeader for Headers

Always use `PageHeader` for page headers:

```vue
<PageHeader
  title="Page Title"
  subtitle="Page description"
/>
```

### 3. Stagger Animations

Use staggered animation delays for sequential reveals:

```vue
<div class="animate-fade-up animate-delay-1">First</div>
<div class="animate-fade-up animate-delay-2">Second</div>
<div class="animate-fade-up animate-delay-3">Third</div>
```

### 4. Use Glass Cards

Prefer glass cards for elevated content:

```vue
<div class="glass-card-elevated p-6 hover-lift">
  <!-- Content -->
</div>
```

### 5. Consistent Loading States

Always use the standardized loading state:

```vue
<div v-if="loading" class="loading-state">
  <Icon name="heroicons:arrow-path" class="loading-spinner" />
  <p class="loading-text">Cargando...</p>
</div>
```

### 6. Consistent Empty States

Always use the standardized empty state:

```vue
<div v-if="items.length === 0" class="empty-state">
  <Icon name="heroicons:inbox" class="empty-state-icon" />
  <h3 class="empty-state-title">No hay elementos</h3>
  <p class="empty-state-description">Descripción</p>
</div>
```

### 7. Use Heroicons

Always use Heroicons for consistency:

```vue
<Icon name="heroicons:plus" class="w-4 h-4" />
```

### 8. Hide Content During Loading

Always hide content during loading to prevent visual glitches:

```vue
<div v-if="loading" class="loading-state">...</div>
<div v-else-if="error" class="error-state">...</div>
<div v-else>
  <!-- Actual content -->
</div>
```

---

## 📚 Examples

### Complete Page Example

```vue
<template>
  <PageLayout container-size="medium">
    <PageHeader
      title="Gestionar Elementos"
      subtitle="Crea y administra elementos del sistema"
      badge="Admin"
      badge-icon="heroicons:shield-check"
    />

    <!-- Filters -->
    <div class="glass-card-elevated p-6 mb-8 animate-fade-up animate-delay-1">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="form-label">Buscar</label>
          <input
            v-model="search"
            type="text"
            class="form-input"
            placeholder="Buscar..."
          />
        </div>
        <div>
          <label class="form-label">Estado</label>
          <select v-model="status" class="form-select">
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="completed">Completados</option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn-primary w-full">Filtrar</button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon name="heroicons:arrow-path" class="loading-spinner" />
      <p class="loading-text">Cargando elementos...</p>
    </div>

    <!-- Content -->
    <div v-else-if="items.length > 0" class="space-y-4 animate-fade-up animate-delay-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="glass-card-elevated p-6 hover-lift"
      >
        <h3 class="text-size-2 font-semibold text-foreground mb-2">{{ item.name }}</h3>
        <p class="text-size-4 text-foreground-muted">{{ item.description }}</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <Icon name="heroicons:inbox" class="empty-state-icon" />
      <h3 class="empty-state-title">No hay elementos</h3>
      <p class="empty-state-description">
        Crea tu primer elemento para comenzar
      </p>
      <button class="btn-primary">Crear Elemento</button>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
const loading = ref(false)
const items = ref([])
const search = ref('')
const status = ref('')
</script>
```

---

## 🎯 Summary

By following this design system guide, you can create new pages that automatically inherit the premium Silicon Valley aesthetic. The key is to:

1. Use `PageLayout` for consistent page structure
2. Use `PageHeader` for consistent headers
3. Use standardized components (glass cards, buttons, forms, etc.)
4. Use staggered animations for smooth reveals
5. Always handle loading and empty states
6. Use Heroicons for consistency
7. Follow the color system and spacing guidelines

For questions or improvements, refer to existing pages like `pages/admin/index.vue`, `pages/matches/[id].vue`, or `pages/index.vue` for reference implementations.


