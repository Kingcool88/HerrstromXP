export const defaultFamily = {
  familyId: 'herrstromxp',
  familyName: 'HerrstromXP',
  parentPin: '2468',
  rules: {
    requireParentApproval: true,
    blockRewardsUntilRequiredDone: true,
    minimumTasksBeforeRewards: 2,
    bonusAllDailyTasks: true,
    allDailyTasksBonusXp: 25,
    streaksEnabled: true,
    streakBonusEveryDays: 3,
    streakBonusXp: 20,
    allowNegativeXp: false,
    weekendBonus: true,
    weekendBonusPercent: 25
  },
  achievements: [
    { id: 'first-task', title: 'Första uppdraget', emoji: '🌟', rule: 'tasksCompleted', target: 1, bonusXp: 10 },
    { id: 'five-tasks', title: 'Fem uppdrag', emoji: '🏅', rule: 'tasksCompleted', target: 5, bonusXp: 20 },
    { id: 'first-reward', title: 'Första köpet', emoji: '🎁', rule: 'rewardsBought', target: 1, bonusXp: 0 },
    { id: 'three-day-streak', title: '3-dagars streak', emoji: '🔥', rule: 'streak', target: 3, bonusXp: 30 }
  ],
  children: [
    { id: 'annie', name: 'Annie', emoji: '🦄', color: '#f472b6', levelEmoji: '✨' },
    { id: 'albin', name: 'Albin', emoji: '🦖', color: '#38bdf8', levelEmoji: '⚡' }
  ],
  tasks: [
    { id: 'make-bed', title: 'Bädda sängen', xp: 10, days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], requiresApproval: false, requiredBeforeRewards: true, category: 'Morgon' },
    { id: 'brush-teeth-morning', title: 'Borsta tänderna morgon', xp: 10, days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], requiresApproval: false, requiredBeforeRewards: true, category: 'Morgon' },
    { id: 'school-bag', title: 'Packa väska', xp: 15, days: ['mon','tue','wed','thu','fri'], childIds: ['annie','albin'], requiresApproval: true, requiredBeforeRewards: true, category: 'Skola/förskola' },
    { id: 'tidy-room', title: 'Plocka undan på rummet', xp: 20, days: ['mon','wed','fri','sun'], childIds: ['annie','albin'], requiresApproval: true, requiredBeforeRewards: false, category: 'Hem' },
    { id: 'dishwasher', title: 'Hjälpa till med diskmaskinen', xp: 20, days: ['tue','thu','sat'], childIds: ['annie','albin'], requiresApproval: true, requiredBeforeRewards: false, category: 'Hem' },
    { id: 'saturday-clean', title: 'Lördagsstädning 15 min', xp: 40, days: ['sat'], childIds: ['annie','albin'], requiresApproval: true, requiredBeforeRewards: false, category: 'Helg' }
  ],
  rewards: [
    { id: 'gaming-30', title: 'TV-spel 30 min', cost: 100, emoji: '🎮', days: ['fri','sat','sun'], childIds: ['annie','albin'], requiresParentConfirm: true },
    { id: 'tablet-20', title: 'Surfplatta 20 min', cost: 70, emoji: '📱', days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], requiresParentConfirm: false },
    { id: 'movie-choice', title: 'Välja film', cost: 120, emoji: '🍿', days: ['fri','sat'], childIds: ['annie','albin'], requiresParentConfirm: false },
    { id: 'stay-up', title: 'Vara uppe 20 min längre', cost: 150, emoji: '🌙', days: ['fri','sat'], childIds: ['annie','albin'], requiresParentConfirm: true }
  ]
}
