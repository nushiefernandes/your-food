export const NUDGE_TEMPLATES = [
  {
    id: 'first_cuisine',
    check: (entry, insights) => {
      if (!entry?.cuisine_type) return null
      const match = (insights?.eating?.cuisine_breakdown || [])
        .find(c => c.cuisine?.toLowerCase() === entry.cuisine_type?.toLowerCase())
      if (match?.count === 1) return `First time having ${entry.cuisine_type}! 🌍`
      return null
    },
  },
  {
    id: 'venue_regular',
    check: (entry, insights) => {
      if (!entry?.venue_name) return null
      const match = (insights?.places?.top_venues || [])
        .find(v => v.name?.toLowerCase() === entry.venue_name?.toLowerCase())
      if (match?.visits >= 3) return `You're becoming a regular at ${entry.venue_name} — ${match.visits} visits!`
      return null
    },
  },
  {
    id: 'cuisine_rating',
    check: (entry, insights) => {
      if (!entry?.cuisine_type || !entry?.rating) return null
      const match = (insights?.eating?.avg_rating_by_cuisine || [])
        .find(c => c.cuisine?.toLowerCase() === entry.cuisine_type?.toLowerCase())
      if (match && entry.rating > match.avg + 1) return `Above your usual ${entry.cuisine_type} rating — this one hit!`
      return null
    },
  },
  {
    id: 'five_star',
    check: (entry) => {
      if (entry?.rating === 5) return `A 5-star meal. You don't hand those out often. ⭐`
      return null
    },
  },
  {
    id: 'new_dish',
    check: (entry, insights) => {
      if (!entry?.dish_name) return null
      const match = (insights?.eating?.top_dishes || [])
        .find(d => d.name?.toLowerCase() === entry.dish_name?.toLowerCase())
      if (match?.count === 1) return `First time logging ${entry.dish_name}!`
      return null
    },
  },
  {
    id: 'cooking_streak',
    check: (entry, insights) => {
      if (entry?.entry_type !== 'home') return null
      const streak = insights?.timing?.logging_streak?.current || 0
      if (streak >= 3) return `${streak} meals logged in a row — the habit's forming! 🍳`
      return null
    },
  },
  {
    id: 'spending',
    check: (entry, insights) => {
      const avg = insights?.spending?.avg_meal_cost
      if (!avg || entry?.cost == null) return null
      if (entry.cost < avg * 0.5) return `Nice find — this one cost way less than your usual.`
      if (entry.cost > avg * 2) return `A splurge — treating yourself?`
      return null
    },
  },
  {
    id: 'companion',
    check: (entry, insights) => {
      if (!entry?.companions) return null
      if ((insights?.social?.solo_pct || 0) > 70) return `Nice to have company for a change! 👥`
      return null
    },
  },
]

export function selectNudge(entry, insights, lastNudgeId = null) {
  if (!insights) return null
  for (const template of NUDGE_TEMPLATES) {
    const text = template.check(entry, insights)
    if (text && template.id !== lastNudgeId) {
      return { id: template.id, text }
    }
  }
  return null
}
