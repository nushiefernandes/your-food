export const MILESTONES = [
  {
    id: 'first_meal',
    label: 'First meal logged!',
    emoji: '🎉',
    confetti: true,
    check: (insights) => insights?.meta?.total_meals === 1,
  },
  {
    id: 'meals_10',
    label: '10 meals logged',
    emoji: '🍽️',
    confetti: false,
    check: (insights) => (insights?.meta?.total_meals || 0) >= 10,
  },
  {
    id: 'meals_25',
    label: '25 meals logged',
    emoji: '📸',
    confetti: false,
    check: (insights) => (insights?.meta?.total_meals || 0) >= 25,
  },
  {
    id: 'meals_50',
    label: '50 meals logged',
    emoji: '🎊',
    confetti: true,
    check: (insights) => (insights?.meta?.total_meals || 0) >= 50,
  },
  {
    id: 'meals_100',
    label: '100 meals logged',
    emoji: '🏆',
    confetti: true,
    check: (insights) => (insights?.meta?.total_meals || 0) >= 100,
  },
  {
    id: 'streak_7',
    label: '7-day logging streak',
    emoji: '🔥',
    confetti: false,
    check: (insights) => (insights?.timing?.logging_streak?.current || 0) >= 7,
  },
  {
    id: 'streak_30',
    label: '30-day logging streak',
    emoji: '🔥🔥🔥',
    confetti: true,
    check: (insights) => (insights?.timing?.logging_streak?.current || 0) >= 30,
  },
  {
    id: 'cuisines_5',
    label: '5 cuisines explored',
    emoji: '🌍',
    confetti: false,
    check: (insights) => (insights?.eating?.cuisine_breakdown || []).length >= 5,
  },
  {
    id: 'cuisines_10',
    label: '10 cuisines explored',
    emoji: '🌎',
    confetti: false,
    check: (insights) => (insights?.eating?.cuisine_breakdown || []).length >= 10,
  },
  {
    id: 'home_meals_10',
    label: '10 home-cooked meals',
    emoji: '🍳',
    confetti: false,
    check: (insights) => (insights?.home_vs_out?.cooking_ratio?.home_count || 0) >= 10,
  },
  {
    id: 'cities_2',
    label: 'Eating in 2+ cities',
    emoji: '✈️',
    confetti: false,
    check: (insights) => (insights?.places?.geographic_range?.count || 0) >= 2,
  },
]

export function checkMilestones(insights, seenIds = []) {
  const ids = seenIds ?? []
  return MILESTONES.filter(m => m.check(insights) && !ids.includes(m.id))
}
