import type { Ref } from 'vue'

// Runs `task` with `pending` true and always resets it, even when the task throws.
export async function withPending<T>(pending: Ref<boolean>, task: () => Promise<T>): Promise<T> {
  pending.value = true
  try {
    return await task()
  } finally {
    pending.value = false
  }
}
