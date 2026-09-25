<template>
  <PageLayout container-size="medium">
    <div class="flow-stack">
      <PageHeader title="Admin debug" subtitle="Metadatos de usuario y verificación de rol." />
      
      <div class="panel">
        <h2 class="panel-title">Auth State</h2>
        <pre class="debug-pre">{{ JSON.stringify(authState, null, 2) }}</pre>
      </div>
      
      <div class="panel">
        <h2 class="panel-title">User Object (Full)</h2>
        <pre class="debug-pre">{{ JSON.stringify(userObject, null, 2) }}</pre>
      </div>
      
      <div class="panel">
        <h2 class="panel-title">Public Metadata (Direct Access)</h2>
        <pre class="debug-pre">{{ JSON.stringify(publicMetadata, null, 2) }}</pre>
      </div>
      
      <div class="panel">
        <h2 class="panel-title">Role Check</h2>
        <div class="space-y-2">
          <p><strong>Role from publicMetadata.role:</strong> {{ role }}</p>
          <p><strong>Is Admin (computed):</strong> {{ isAdmin }}</p>
          <p><strong>Is Admin (server check):</strong> {{ serverIsAdmin !== null ? serverIsAdmin : 'Loading...' }}</p>
        </div>
      </div>
      
      <div class="panel">
        <h2 class="panel-title">Actions</h2>
        <button @click="refreshData" class="btn-primary mb-2">Refresh Data</button>
        <button @click="checkServerAdmin" class="btn-secondary">Check Server-Side Admin Status</button>
      </div>
    </div>
  </PageLayout>
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
  return {
    id: user.value.id,
    firstName: user.value.firstName,
    lastName: user.value.lastName,
    emailAddresses: user.value.emailAddresses,
    publicMetadata: user.value.publicMetadata,
    unsafeMetadata: user.value.unsafeMetadata,
    privateMetadata: user.value.privateMetadata ? '[REDACTED]' : null,
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
  } catch (error: any) {
    console.error('Error checking server admin:', error)
    alert(`Error: ${error.message || 'Failed to check admin status'}`)
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


<style scoped>
.debug-pre { padding: 16px; border-radius: 14px; background: var(--background); border: 1px solid var(--edge); font-family: var(--font-mono); font-size: 13px; overflow: auto; }
</style>
