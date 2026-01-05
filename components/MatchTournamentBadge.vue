<template>
  <div v-if="match?.tournament || match?.tournament_match" class="inline-flex items-center gap-2">
    <span
      v-if="match.tournament"
      class="px-3 py-1 rounded-full text-size-4 font-semibold bg-accent-subtle/30 text-accent border border-accent/30"
    >
      <Icon name="heroicons:trophy-cup" class="w-3 h-3 inline mr-1" />
      {{ getBadgeText() }}
    </span>
    <span
      v-else
      class="px-3 py-1 rounded-full text-size-4 font-semibold bg-surface border border-border-subtle text-foreground-muted"
    >
      1-on-1
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Match } from '~/types'

interface Props {
  match: Match | null
}

const props = defineProps<Props>()

const getBadgeText = () => {
  if (!props.match?.tournament || !props.match?.tournament_match) {
    return props.match?.tournament?.name || 'Torneo'
  }

  const tournament = props.match.tournament
  const tournamentMatch = Array.isArray(props.match.tournament_match) 
    ? props.match.tournament_match[0] 
    : props.match.tournament_match

  if (!tournamentMatch) {
    return tournament.name
  }

  const bracketType = tournamentMatch.bracket_type
  const roundNumber = tournamentMatch.round_number

  if (bracketType === 'group' && tournamentMatch.group?.group_name) {
    return `${tournament.name} - ${tournamentMatch.group.group_name}`
  }

  if (bracketType === 'main') {
    const roundNames: Record<number, string> = {
      1: 'Cuartos de Final',
      2: 'Semifinales',
      3: 'Final'
    }
    return `${tournament.name} - ${roundNames[roundNumber || 1] || `Ronda ${roundNumber}`}`
  }

  if (bracketType === 'backdraw') {
    const roundNames: Record<number, string> = {
      1: 'Cuartos de Final',
      2: 'Semifinales',
      3: 'Final'
    }
    return `${tournament.name} - Consolación ${roundNames[roundNumber || 1] || `Ronda ${roundNumber}`}`
  }

  return tournament.name
}
</script>

