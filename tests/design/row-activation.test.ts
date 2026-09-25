import { describe, expect, it } from 'vitest'
import { isOwnRowActivation } from '../../utils/rowActivation'
import { SEED, int, mulberry32, pick } from './prng'

const KEYS = ['Enter', ' ', 'Tab', 'Escape', 'ArrowDown', 'a', 'NumpadEnter'] as const
const INNER = ['a', 'span', 'strong', 'button'] as const

/** A match row as rendered in pages/matches/index.vue: focusable row with nested player/winner links. */
function buildRow(rand: () => number) {
  const row = document.createElement('div')
  row.setAttribute('role', 'link')
  row.tabIndex = 0
  const nodes: HTMLElement[] = [row]
  const n = int(rand, 0, 8)
  for (let i = 0; i < n; i++) {
    const el = document.createElement(pick(rand, INNER))
    if (el.tagName === 'A') el.setAttribute('href', `/players/p${i}`)
    pick(rand, nodes).appendChild(el)
    nodes.push(el)
  }
  return { row, nodes }
}

/** Real DOM dispatch: the listener sits on the row, like `@keydown.enter` does, and events bubble. */
function pressOn(row: HTMLElement, target: HTMLElement, key: string) {
  let opened = 0
  const listener = (e: Event) => { if (isOwnRowActivation(e as KeyboardEvent)) opened++ }
  row.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  row.removeEventListener('keydown', listener)
  return opened
}

describe('isOwnRowActivation (property, real DOM bubbling)', () => {
  it('opens the match only for Enter pressed on the row itself, never for a key bubbling from inside it', () => {
    const rand = mulberry32(SEED + 50)
    for (let i = 0; i < 2000; i++) {
      const { row, nodes } = buildRow(rand)
      const target = pick(rand, nodes)
      const key = pick(rand, KEYS)
      expect(pressOn(row, target, key)).toBe(key === 'Enter' && target === row ? 1 : 0)
    }
  })
})

describe('isOwnRowActivation regressions', () => {
  // Bugbot PR #6 (4101439289): Enter on the player NuxtLink bubbled to the row and also opened the match
  it('Enter on the "María José Villacís" player link inside a match row does not open the match', () => {
    const row = document.createElement('div'); row.tabIndex = 0
    const players = document.createElement('span')
    const link = document.createElement('a'); link.href = '/players/p42'; link.textContent = 'María José Villacís'
    players.appendChild(link); row.appendChild(players)
    expect(pressOn(row, link, 'Enter')).toBe(0)
    expect(pressOn(row, row, 'Enter')).toBe(1)
  })

  it('Enter during IME composition on the row does not open the match', () => {
    const row = document.createElement('div')
    expect(isOwnRowActivation({ key: 'Enter', target: row, currentTarget: row, isComposing: true })).toBe(false)
  })
})
