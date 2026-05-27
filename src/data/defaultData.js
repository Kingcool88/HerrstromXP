export const defaultData = {
  children: [
    { id: 'annie', name: 'Annie', avatar: '🦄', color: '#ec4899' },
    { id: 'albin', name: 'Albin', avatar: '🦖', color: '#22c55e' }
  ],
  tasks: [
    { id: 'bed', title: 'Bädda sängen', points: 10, icon: '🛏️', days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], category: 'Morgon' },
    { id: 'laundry', title: 'Smutstvätt i tvättkorgen', points: 10, icon: '🧺', days: ['mon','wed','fri','sun'], childIds: ['annie','albin'], category: 'Rum' },
    { id: 'table', title: 'Duka av efter maten', points: 15, icon: '🍽️', days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], category: 'Kök' },
    { id: 'toys', title: 'Plocka undan leksaker', points: 15, icon: '🧸', days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], category: 'Kväll' },
    { id: 'trash', title: 'Hjälpa till med soporna', points: 20, icon: '🗑️', days: ['thu'], childIds: ['albin'], category: 'Extra' },
    { id: 'plant', title: 'Vattna en växt', points: 10, icon: '🌱', days: ['sat'], childIds: ['annie'], category: 'Extra' }
  ],
  rewards: [
    { id: 'gaming30', title: 'TV-spel 30 minuter', cost: 100, icon: '🎮', days: ['fri','sat','sun'], childIds: ['annie','albin'], resetDaily: true },
    { id: 'screen15', title: 'Skärmtid 15 minuter', cost: 60, icon: '📱', days: ['mon','tue','wed','thu'], childIds: ['annie','albin'], resetDaily: true },
    { id: 'movie', title: 'Välj fredagsfilm', cost: 150, icon: '🎬', days: ['fri'], childIds: ['annie','albin'], resetDaily: true },
    { id: 'story', title: 'Extra sagostund', cost: 80, icon: '📚', days: ['mon','tue','wed','thu','fri','sat','sun'], childIds: ['annie','albin'], resetDaily: true }
  ],
  settings: {
    dailyBonusXp: 25,
    levelSizeXp: 500
  }
}

export const defaultState = {
  completions: {},
  purchases: {}
}
