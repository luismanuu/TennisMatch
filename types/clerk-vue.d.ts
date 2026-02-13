declare module '@clerk/vue' {
  import type { DefineComponent } from 'vue'

  /**
   * Minimal type surface needed by `@clerk/nuxt` module options.
   *
   * The Nuxt module re-exports module options based on `@clerk/vue`'s `PluginOptions`.
   * We extend it here to include `localization`, which is supported in runtime but
   * not present in the current type surface used by this repo.
   */
  export interface PluginOptions {
    localization?: unknown
    // Keep this permissive so we don't accidentally narrow upstream options.
    [key: string]: unknown
  }

  // We only need basic component typings for TS to be happy.
  export const UserProfile: DefineComponent<Record<string, never>, Record<string, never>, unknown>
}

export {}

