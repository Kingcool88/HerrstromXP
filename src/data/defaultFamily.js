export const defaultFamily = {
  familyId: 'herrstromxp',
  parentPin: '2468',
  children: [
    { id: 'annie', name: 'Annie', emoji: '🦄', color: '#f472b6' },
    { id: 'albin', name: 'Albin', emoji: '🦖', color: '#38bdf8' }
  ],
  tasks: [
    { id: 'make-bed', title: 'Bädda sängen', xp: 10, days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], requiresApproval: false },
    { id: 'brush-teeth-morning', title: 'Borsta tänderna morgon', xp: 10, days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], requiresApproval: false },
    { id: 'school-bag', title: 'Packa skolväska/förskoleväska', xp: 15, days: ['mon','tue','wed','thu','fri'], childIds: ['annie','albin'], requiresApproval: true },
    { id: 'tidy-room', title: 'Plocka undan på rummet', xp: 20, days: ['mon','wed','fri','sun'], childIds: ['annie','albin'], requiresApproval: true },
    { id: 'dishwasher', title: 'Hjälpa till med diskmaskinen', xp: 20, days: ['tue','thu','sat'], childIds: ['annie','albin'], requiresApproval: true },
    { id: 'saturday-clean', title: 'Lördagsstädning 15 minuter', xp: 40, days: ['sat'], childIds: ['annie','albin'], requiresApproval: true }
  ],
  rewards: [
    { id: 'gaming-30', title: 'TV-spel 30 min', cost: 100, emoji: '🎮', days: ['fri','sat','sun'], childIds: ['annie','albin'] },
    { id: 'tablet-20', title: 'Surfplatta 20 min', cost: 70, emoji: '📱', days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'] },
    { id: 'movie-choice', title: 'Välja film', cost: 120, emoji: '🍿', days: ['fri','sat'], childIds: ['annie','albin'] },
    { id: 'stay-up', title: 'Vara uppe 20 min längre', cost: 150, emoji: '🌙', days: ['fri','sat'], childIds: ['annie','albin'] }
  ]
}
