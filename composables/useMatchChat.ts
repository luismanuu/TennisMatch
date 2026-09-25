import type { MatchMessage, CreateMatchMessagePayload } from '~/types'

interface OptimisticMessage extends MatchMessage {
  _optimistic?: boolean
  _sending?: boolean
  _error?: boolean
}

export const useMatchChat = () => {
  const messages = ref<OptimisticMessage[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isPolling = ref(false)
  const lastFetchTime = ref<number>(0)
  
  // Expose setter for isPolling so parent can control it
  // This is safe because we're modifying the ref internally, not through the readonly export
  const setPolling = (value: boolean) => {
    if (isPolling.value !== value) {
      isPolling.value = value
    }
  }
  
  // Sort messages by created_at to ensure proper ordering
  const sortMessages = (msgs: OptimisticMessage[]) => {
    return [...msgs].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateA - dateB
    })
  }
  
  const fetchMessages = async (matchId: string, accountId: string, since?: string, retries = 3, isPolling = false): Promise<MatchMessage[]> => {
    // Prevent concurrent fetches
    const now = Date.now()
    if (now - lastFetchTime.value < 500) {
      return messages.value as MatchMessage[]
    }
    lastFetchTime.value = now
    
    // Only set loading for initial loads, not for polling updates
    if (!isPolling) {
      loading.value = true
    }
    error.value = null
    
    try {
      const query: any = {}
      if (since) {
        query.since = since
      }
      
      const data = await $fetch<MatchMessage[]>(`/api/matches/${matchId}/messages`, { query })
      
      // If we're fetching incremental updates, append to existing messages (avoid duplicates)
      if (since && data.length > 0) {
        const existingIds = new Set(messages.value.map(m => m.id))
        const newMessages = data.filter(m => !existingIds.has(m.id))
        if (newMessages.length > 0) {
          // Keep optimistic messages and add new ones
          const optimisticMessages = messages.value.filter(m => m._optimistic)
          messages.value = sortMessages([...optimisticMessages, ...newMessages])
        }
      } else {
        // Full refresh - merge intelligently to prevent flickering
        // Strategy: Keep all existing confirmed messages, update them, add new ones
        const currentMessages = [...messages.value]
        const serverMessageIds = new Set(data.map(m => m.id))
        const serverMessagesMap = new Map(data.map(m => [m.id, m]))
        
        // Separate messages into categories
        const confirmedMessages = currentMessages.filter(m => !m._optimistic)
        const optimisticSending = currentMessages.filter(m => m._optimistic && m._sending)
        
        // Update existing confirmed messages with server data
        const updatedConfirmed = confirmedMessages.map(msg => {
          return serverMessagesMap.get(msg.id) || msg
        })
        
        // Add new messages from server that don't exist locally
        const newMessages = data.filter(m => {
          const exists = currentMessages.some(existing => existing.id === m.id)
          return !exists
        })
        
        // Combine: updated confirmed + optimistic sending + new messages
        messages.value = sortMessages([...updatedConfirmed, ...optimisticSending, ...newMessages])
      }
      
      return data
    } catch (err: any) {
      // Retry logic for network errors
      if (retries > 0 && (err.statusCode >= 500 || !err.statusCode)) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchMessages(matchId, accountId, since, retries - 1, isPolling)
      }
      error.value = err
      throw err
    } finally {
      if (!isPolling) {
        loading.value = false
      }
    }
  }
  
  const sendMessage = async (matchId: string, accountId: string, payload: CreateMatchMessagePayload): Promise<MatchMessage> => {
    // Create optimistic message
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimisticMessage: OptimisticMessage = {
      id: tempId,
      match_id: matchId,
      player_id: '', // Will be filled from response
      message: payload.message,
      created_at: new Date().toISOString(),
      _optimistic: true,
      _sending: true
    }
    
    // Add optimistic message immediately
    messages.value = sortMessages([...messages.value, optimisticMessage])
    
    error.value = null
    
    try {
      const data = await $fetch<MatchMessage>(`/api/matches/${matchId}/messages`, {
        method: 'POST',
        body: {
          ...payload
        }
      })
      
      // Replace optimistic message with real one
      const messageIndex = messages.value.findIndex(m => m.id === tempId)
      if (messageIndex !== -1) {
        messages.value[messageIndex] = data
      } else {
        // If not found, add it (shouldn't happen but safety check)
        const existingIds = new Set(messages.value.map(m => m.id))
        if (!existingIds.has(data.id)) {
          messages.value = sortMessages([...messages.value, data])
        }
      }
      
      // Sort to ensure proper order
      messages.value = sortMessages(messages.value)
      
      return data
    } catch (err: any) {
      // Mark optimistic message as error
      const messageIndex = messages.value.findIndex(m => m.id === tempId)
      if (messageIndex !== -1) {
        messages.value[messageIndex] = {
          ...optimisticMessage,
          _sending: false,
          _error: true
        }
      }
      error.value = err
      throw err
    }
  }
  
  const clearMessages = () => {
    messages.value = []
  }
  
  const removeOptimisticMessage = (tempId: string) => {
    messages.value = messages.value.filter(m => m.id !== tempId)
  }
  
  return {
    messages: readonly(messages),
    loading: readonly(loading),
    error: readonly(error),
    // Don't export isPolling as readonly to avoid Vue warnings
    // Instead, provide a computed that reads it
    isPolling: computed(() => isPolling.value),
    setPolling,
    fetchMessages,
    sendMessage,
    clearMessages,
    removeOptimisticMessage
  }
}

