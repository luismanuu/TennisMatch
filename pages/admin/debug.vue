<template>
  <div class="min-h-screen p-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Admin Debug - User Metadata</h1>
      
      <div class="bg-surface border border-border rounded-lg p-6 mb-4">
        <h2 class="text-lg font-semibold mb-2">Auth State</h2>
        <pre class="bg-background p-4 rounded text-sm overflow-auto">{{ JSON.stringify(authState, null, 2) }}</pre>
      </div>
      
      <div class="bg-surface border border-border rounded-lg p-6 mb-4">
        <h2 class="text-lg font-semibold mb-2">User Object (Full)</h2>
        <pre class="bg-background p-4 rounded text-sm overflow-auto">{{ JSON.stringify(userObject, null, 2) }}</pre>
      </div>
      
      <div class="bg-surface border border-border rounded-lg p-6 mb-4">
        <h2 class="text-lg font-semibold mb-2">Public Metadata (Direct Access)</h2>
        <pre class="bg-background p-4 rounded text-sm overflow-auto">{{ JSON.stringify(publicMetadata, null, 2) }}</pre>
      </div>
      
      <div class="bg-surface border border-border rounded-lg p-6 mb-4">
        <h2 class="text-lg font-semibold mb-2">Role Check</h2>
        <div class="space-y-2">
          <p><strong>Role from publicMetadata.role:</strong> {{ role }}</p>
          <p><strong>Is Admin (computed):</strong> {{ isAdmin }}</p>
          <p><strong>Is Admin (server check):</strong> {{ serverIsAdmin !== null ? serverIsAdmin : 'Loading...' }}</p>
        </div>
      </div>
      
      <div class="bg-surface border border-border rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-2">Actions</h2>
        <button @click="refreshData" class="btn-primary mb-2">Refresh Data</button>
        <button @click="checkServerAdmin" class="btn-secondary">Check Server-Side Admin Status</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: []
})

const auth = useAuth()
const { isLoaded: authLoaded, isSignedIn, userId: clerkUserId } = auth
const { isLoaded: userLoaded, user } = useUser()

const authState = computed(() => ({
  authLoaded: authLoaded.value,
  isSignedIn: isSignedIn.value,
  userId: clerkUserId.value,
  userLoaded: userLoaded.value,
  hasUser: !!user.value
}))

const userObject = computed(() => {
  if (!user.value) return null

  const u = user.value as unknown as Record<string, unknown>
  const hasPrivateMetadata = 'privateMetadata' in u && u.privateMetadata != null

  return {
    id: user.value.id,
    firstName: user.value.firstName,
    lastName: user.value.lastName,
    emailAddresses: user.value.emailAddresses,
    publicMetadata: user.value.publicMetadata,
    unsafeMetadata: user.value.unsafeMetadata,
    privateMetadata: hasPrivateMetadata ? '[REDACTED]' : null,
    // Get all keys
    allKeys: Object.keys(user.value)
  }
})

const publicMetadata = computed(() => user.value?.publicMetadata || null)

const role = computed(() => {
  const metadata = user.value?.publicMetadata
  if (!metadata) return 'No metadata'
  if (typeof metadata === 'object' && 'role' in metadata) {
    return metadata.role
  }
  return 'No role found'
})

const isAdmin = computed(() => {
  const roleValue = user.value?.publicMetadata?.role as string | undefined
  return roleValue === 'admin'
})

const serverIsAdmin = ref<boolean | null>(null)

const checkServerAdmin = async () => {
  if (!clerkUserId.value) {
    alert('No user ID available')
    return
  }
  
  serverIsAdmin.value = null
  try {
    const result = await $fetch<{ isAdmin: boolean }>('/api/admin/check', {
      query: { clerk_id: clerkUserId.value }
    })
    serverIsAdmin.value = result.isAdmin
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to check admin status'
    console.error('Error checking server admin:', error)
    alert(`Error: ${message}`)
  }
}

const refreshData = () => {
  // Force refresh by accessing the computed values
  console.log('Refreshing data...')
  checkServerAdmin()
}

onMounted(() => {
  if (clerkUserId.value) {
    checkServerAdmin()
  }
})
</script>

