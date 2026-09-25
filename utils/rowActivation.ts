/**
 * Keyboard activation for a clickable list row (`role="link"`, `tabindex="0"`) that
 * also contains real links (player names, winner). Enter opens the row only when the
 * row itself has focus. Enter on an inner <a> belongs to that link: letting it bubble
 * to the row would start a second, competing navigation to the match.
 */
export interface RowKeyEvent {
  key: string
  target: EventTarget | null
  currentTarget: EventTarget | null
  isComposing?: boolean
}

export const isOwnRowActivation = (e: RowKeyEvent): boolean =>
  e.key === 'Enter' && !e.isComposing && e.target !== null && e.target === e.currentTarget
