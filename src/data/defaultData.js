// Default categories, preset themes, and rich initial sample data for Celebration & Event Planner

import { samplePhotosFor } from '../lib/photos/photoModel';

export const EVENT_TYPES = [
  { id: 'wedding', label: 'Wedding', icon: '💍', color: 'from-pink-500 to-rose-600', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'birthday', label: 'Birthday Party', icon: '🎂', color: 'from-amber-500 to-orange-600', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'anniversary', label: 'Anniversary', icon: '🥂', color: 'from-purple-500 to-indigo-600', badgeBg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'community', label: 'Community Event', icon: '🤝', color: 'from-emerald-500 to-teal-600', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'gala', label: 'Charity Gala / Corporate', icon: '🎭', color: 'from-blue-500 to-indigo-700', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'babyshower', label: 'Baby Shower', icon: '👶', color: 'from-cyan-400 to-blue-500', badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
];

export const BUDGET_CATEGORIES = [
  { id: 'venue', label: 'Venue & Rentals', icon: '🏰', defaultPct: 35, color: '#6366F1' },
  { id: 'catering', label: 'Catering & Beverages', icon: '🍽️', defaultPct: 25, color: '#EC4899' },
  { id: 'photography', label: 'Photography & Video', icon: '📸', defaultPct: 12, color: '#8B5CF6' },
  { id: 'decoration', label: 'Decoration & Florals', icon: '🌸', defaultPct: 10, color: '#F59E0B' },
  { id: 'entertainment', label: 'Entertainment & Music', icon: '🎵', defaultPct: 8, color: '#10B981' },
  { id: 'attire', label: 'Attire & Beauty', icon: '👗', defaultPct: 5, color: '#06B6D4' },
  { id: 'stationery', label: 'Invitations & Favors', icon: '💌', defaultPct: 3, color: '#F43F5E' },
  { id: 'miscellaneous', label: 'Miscellaneous & Contingency', icon: '📦', defaultPct: 2, color: '#64748B' },
];

export const VENDOR_CATEGORIES = [
  { id: 'venue', label: 'Venue', icon: '🏰' },
  { id: 'catering', label: 'Catering & Food', icon: '🍽️' },
  { id: 'decoration', label: 'Decoration & Florals', icon: '🌸' },
  { id: 'photography', label: 'Photography & Videography', icon: '📸' },
  { id: 'entertainment', label: 'Music & Entertainment', icon: '🎵' },
  { id: 'cake', label: 'Bakery & Cake', icon: '🍰' },
  { id: 'attire', label: 'Attire & Hair/Makeup', icon: '💄' },
  { id: 'rentals', label: 'Equipment & Furniture Rentals', icon: '🪑' },
];

export const VENDOR_STATUSES = [
  { id: 'researching', label: 'Researching', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'quote_received', label: 'Quote Received', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'booked', label: 'Booked / Confirmed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'deposit_paid', label: 'Deposit Paid', color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

/* Guest list & RSVP model ----------------------------------------------- */

export const RSVP_STATUSES = [
  { id: 'invited', label: 'Invited', short: 'Awaiting', color: 'bg-slate-100 text-slate-700 border-slate-300', progress: 'bg-slate-300' },
  { id: 'attending', label: 'Attending', short: 'Yes', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', progress: 'bg-emerald-500' },
  { id: 'maybe', label: 'Maybe', short: 'TBD', color: 'bg-amber-50 text-amber-700 border-amber-200', progress: 'bg-amber-400' },
  { id: 'declined', label: 'Declined', short: 'No', color: 'bg-rose-50 text-rose-700 border-rose-200', progress: 'bg-rose-300' },
];

export const MEAL_OPTIONS = [
  { id: 'standard', label: 'Standard', icon: '🍽️' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { id: 'kids', label: "Kids' Meal", icon: '🧒' },
  { id: 'other', label: 'Other / Note', icon: '📝' },
];

export const GUEST_GROUPS = [
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'friends', label: 'Friends', icon: '🤗' },
  { id: 'colleagues', label: 'Colleagues', icon: '💼' },
  { id: 'vip', label: 'VIP / Honored', icon: '⭐' },
  { id: 'vendors', label: 'Vendor Team', icon: '🎪' },
];

export const TIMELINE_PHASES = [
  { id: 'early', label: 'Early Planning (3+ Months Prior)' },
  { id: 'mid', label: 'Month Out (4-6 Weeks Prior)' },
  { id: 'final', label: 'Final Countdown (1-2 Weeks Prior)' },
  { id: 'day_of', label: 'Day of Celebration' },
  { id: 'post', label: 'Post-Event Wrap-up' },
];

export const CURATED_THEMES = [
  {
    id: 'rustic-tuscan',
    eventType: 'wedding',
    name: 'Rustic Tuscan Romance',
    tagline: 'Warm terracotta, olive branch greenery, and sunlit vineyard charm',
    palette: ['#C46851', '#7A8B7B', '#E8D5B5', '#4A3B32'],
    paletteNames: ['Terracotta', 'Olive Leaf', 'Warm Sand', 'Espresso Wood'],
    decorHighlights: [
      'Bare wood banquet tables draped with seeded eucalyptus & white ranunculus',
      'Fairy festoon string lighting with amber Edison vintage filaments',
      'Handmade deckle-edge parchment stationery with wax seals',
      'Artisan olive oil bottles as custom personalized guest favors'
    ],
    recommendedMusic: 'Acoustic guitar duo followed by a 4-piece indie-folk band',
    cateringIdeas: 'Woodfired flatbreads, burrata salad, truffle risotto, regional wine pairing',
    budgetTip: 'Save by choosing in-season local foliage instead of imported exotic blooms.'
  },
  {
    id: 'celestial-noir',
    eventType: 'wedding',
    name: 'Modern Celestial Elegance',
    tagline: 'Deep midnight navy, cascading silver stars, and crystal candlelit drama',
    palette: ['#0F172A', '#38BDF8', '#E2E8F0', '#FCD34D'],
    paletteNames: ['Midnight Sky', 'Cosmic Blue', 'Star White', 'Astral Gold'],
    decorHighlights: [
      'Gobo star projectors illuminating the vaulted ceiling dance floor',
      'Mirrored acrylic table chargers reflecting tapered black and ivory candles',
      'Floating floral rings with silver lunaria and white orchids',
      'Deep blue velvet lounge seating with metallic cocktail tables'
    ],
    recommendedMusic: 'Modern cinematic strings covering contemporary pop & jazz hits',
    cateringIdeas: 'Smoked cocktail arrivals, black sesame macarons, champagne oyster bar',
    budgetTip: 'Focus accent lighting heavily to transform low-cost drapery into starry wonder.'
  },
  {
    id: 'synthwave-80s',
    eventType: 'birthday',
    name: 'Retro Neon Synthwave & Arcade',
    tagline: 'Electric magenta, neon cyan grid visuals, and upbeat nostalgic energy',
    palette: ['#F43F5E', '#06B6D4', '#8B5CF6', '#0F172A'],
    paletteNames: ['Laser Pink', 'Cyber Cyan', 'Neon Purple', 'Synth Black'],
    decorHighlights: [
      'Custom glowing LED neon name sign photo opportunity with mirrored backdrop',
      'Retro arcade cabinets (Pac-Man, Street Fighter) free to play',
      'Glow-in-the-dark wristbands and retro shutter shade glasses',
      'Cassette tape place cards and holographic table runners'
    ],
    recommendedMusic: '80s synthpop remixes, Daft Punk, electronic dance classics by live DJ',
    cateringIdeas: 'Sliders bar, neon galaxy glazed donuts, spiked berry mocktails & cocktails',
    budgetTip: 'Rent a UV blacklight projector kit to make white and fluorescent elements pop!'
  },
  {
    id: 'boho-sunset-picnic',
    eventType: 'birthday',
    name: 'Golden Hour Bohemian Oasis',
    tagline: 'Pampas grass, low wooden pallet tables, plush floor cushions, and sunset glow',
    palette: ['#F59E0B', '#E11D48', '#D97706', '#F3F4F6'],
    paletteNames: ['Marigold', 'Wild Rose', 'Warm Ochre', 'Cream Macrame'],
    decorHighlights: [
      'Low wooden farm tables with Turkish floor rugs and linen pillows',
      'Tall fluffy pampas arrangements in terracotta amphora vases',
      'Woven rattan lanterns with warm LED flameless pillar candles',
      'Polaroid guestbook station with floral dried-flower washi tape'
    ],
    recommendedMusic: 'Lo-fi chill beats and indie acoustic singer-songwriter playlist',
    cateringIdeas: 'Elaborate grazing board with artisanal cheeses, fig jam, artisanal breads',
    budgetTip: 'Thrift or borrow rugs, woven poufs, and brass candlesticks for authentic eclectic styling.'
  },
  {
    id: 'silver-anniversary',
    eventType: 'anniversary',
    name: 'Silver Radiance & Champagne Noir',
    tagline: 'Refined celebration of lasting love with sparkling silver and frosted glassware',
    palette: ['#94A3B8', '#F8FAFC', '#475569', '#E2E8F0'],
    paletteNames: ['Polished Silver', 'Silk White', 'Slate Smoke', 'Frosted Platinum'],
    decorHighlights: [
      'Cascading white hydrangea centerpieces with reflective mercury glass votives',
      'Archive gallery photo wall depicting 25 milestone moments throughout the years',
      'Silver-rimmed crystal champagne flutes for the anniversary toast',
      'Monogrammed silver foil menus and linen napkins'
    ],
    recommendedMusic: 'Smooth 50s-70s romantic jazz quartet and saxophone solos',
    cateringIdeas: 'Beef tenderloin medallions, champagne poached salmon, 3-tier silver leaf cake',
    budgetTip: 'Curate a digital photo slideshow on high-res monitors to save on framed printing costs.'
  },
  {
    id: 'eco-community-fair',
    eventType: 'community',
    name: 'Eco-Blossom Artisan Carnival',
    tagline: 'Zero-waste community festivity, local maker booths, live acoustic, and family fun',
    palette: ['#10B981', '#059669', '#FBBF24', '#0284C7'],
    paletteNames: ['Leaf Green', 'Forest Pine', 'Solar Gold', 'Fresh Sky'],
    decorHighlights: [
      'Upcycled fabric bunting and colorful chalkboard directional signposts',
      'Biodegradable seed-paper badges that attendees can plant at home',
      'Hay bale seating clusters with washable gingham picnic blankets',
      'Solar-powered ambient fairy lights strung between trees and vendor tents'
    ],
    recommendedMusic: 'Local youth brass band, community choir, and acoustic folk buskers',
    cateringIdeas: 'Farm-to-table food truck lane, locally sourced fruit slushies, homemade baked goods',
    budgetTip: 'Partner with local green businesses for sponsored compostable cups and tote bags.'
  }
];

export const INITIAL_EVENTS = [
  {
    id: 'event-wedding-01',
    title: "Sophia & Liam's Sunset Vineyard Wedding",
    type: 'wedding',
    date: '2026-11-20',
    time: '16:00',
    location: 'Napa Valley Vista Winery & Estate, St. Helena, CA',
    guestCount: 120,
    budget: 32000,
    description: 'An intimate sunset wedding featuring rustic Tuscan aesthetics, farm-to-table dining, string quartet, and outdoor vineyard dining under fairy canopy lights.',
    themeName: 'Rustic Tuscan Romance',
    themeColor: '#8b5cf6',
    notes: 'Bride prefers blush and eucalyptus greenery; Groom requested local Cabernet Sauvignon wine flights.',
    createdAt: '2026-08-01T10:00:00Z',
    expenses: [
      { id: 'exp-1', name: 'Napa Vista Winery Venue & Grounds', category: 'venue', allocated: 9500, spent: 9500, paid: true, date: '2026-08-15', notes: 'Includes reception lawn, ceremony terrace, and bridal suite.' },
      { id: 'exp-2', name: 'Farm-to-Table Plated Dinner & Wine Service', category: 'catering', allocated: 8200, spent: 7800, paid: true, date: '2026-09-02', notes: 'Covers 120 guests + 6 vendor meals.' },
      { id: 'exp-3', name: 'Lumiere Fine Art Photography & 4K Video', category: 'photography', allocated: 4200, spent: 4200, paid: true, date: '2026-08-20', notes: 'Full day 9-hour coverage, drone aerials, second shooter.' },
      { id: 'exp-4', name: 'Botanica Floral Design & Arch Garland', category: 'decoration', allocated: 3400, spent: 3150, paid: false, date: '2026-10-10', notes: 'Ceremony arch, 12 table runners, bouquets, boutonnieres.' },
      { id: 'exp-5', name: 'Golden Gate String Quartet & Evening DJ', category: 'entertainment', allocated: 2600, spent: 2600, paid: true, date: '2026-09-12', notes: 'Acoustic strings for ceremony & cocktail hour + DJ reception.' },
      { id: 'exp-6', name: 'Artisan 3-Tier Fig & Vanilla Bean Wedding Cake', category: 'catering', allocated: 750, spent: 720, paid: false, date: '2026-10-14', notes: 'Custom cake with edible gold leaf & pressed flowers.' },
      { id: 'exp-7', name: 'Letterpress Wedding Invitations & Wax Seals', category: 'stationery', allocated: 650, spent: 580, paid: true, date: '2026-08-25', notes: 'Handcrafted deckle paper with custom calligraphy.' },
      { id: 'exp-8', name: 'Bridal Gown Alterations & Veil Styling', category: 'attire', allocated: 1200, spent: 1100, paid: true, date: '2026-09-28', notes: 'Final fitting completed.' },
      { id: 'exp-9', name: 'Emergency Contingency Fund', category: 'miscellaneous', allocated: 1500, spent: 300, paid: false, date: '2026-10-15', notes: 'Heaters rental reserved if evening gets chilly.' },
    ],
    tasks: [
      { id: 'task-1', title: 'Finalize venue contract & deposit', phase: 'early', category: 'venue', dueDate: '2026-08-15', priority: 'high', completed: true, notes: 'Signed and confirmed' },
      { id: 'task-2', title: 'Book lead photographer & videographer team', phase: 'early', category: 'photography', dueDate: '2026-08-20', priority: 'high', completed: true, notes: 'Contract executed with Lumiere' },
      { id: 'task-3', title: 'Conduct menu tasting with vineyard caterer', phase: 'early', category: 'catering', dueDate: '2026-09-02', priority: 'medium', completed: true, notes: 'Menu selections finalized' },
      { id: 'task-4', title: 'Mail formal RSVP invitations', phase: 'mid', category: 'stationery', dueDate: '2026-09-15', priority: 'high', completed: true, notes: 'All 120 invitations sent out' },
      { id: 'task-5', title: 'Select bridal party florals & centerpieces', phase: 'mid', category: 'decoration', dueDate: '2026-10-10', priority: 'medium', completed: true, notes: 'Sample centerpiece approved' },
      { id: 'task-6', title: 'Confirm playlist & "Do Not Play" list with DJ', phase: 'final', category: 'entertainment', dueDate: '2026-11-05', priority: 'medium', completed: false, notes: 'First dance song chosen: Leon Bridges' },
      { id: 'task-7', title: 'Create final reception seating chart', phase: 'final', category: 'venue', dueDate: '2026-11-10', priority: 'high', completed: false, notes: 'Awaiting 3 final RSVP confirmations' },
      { id: 'task-8', title: 'Assemble guest welcome bags & wine favors', phase: 'final', category: 'stationery', dueDate: '2026-11-14', priority: 'low', completed: false, notes: 'Need to bottle custom olive oils' },
      { id: 'task-9', title: 'Distribute timeline to vendors & wedding party', phase: 'final', category: 'miscellaneous', dueDate: '2026-11-16', priority: 'high', completed: false, notes: 'Include contact sheets for maid of honor & best man' },
      { id: 'task-10', title: 'Rehearsal dinner walk-through at venue terrace', phase: 'day_of', category: 'venue', dueDate: '2026-11-19', priority: 'high', completed: false, notes: 'Rehearsal starts promptly at 5:00 PM' }
    ],
    vendors: [
      { id: 'v-1', name: 'Napa Valley Vista Winery', category: 'venue', contactPerson: 'Clara Beaumont', phone: '(707) 555-0192', email: 'events@napavistawinery.com', cost: 9500, status: 'booked', rating: 5, notes: 'Access allowed starting at 11:00 AM on wedding day' },
      { id: 'v-2', name: 'Artisan Vineyard Table Catering', category: 'catering', contactPerson: 'Chef Mateo Rossi', phone: '(707) 555-8314', email: 'mateo@vineyardtable.com', cost: 7800, status: 'booked', rating: 5, notes: 'Special gluten-free and vegan plates arranged', quotes: [
        { id: 'q-w2a', company: 'Artisan Vineyard Table Catering', amount: 7800, date: '2026-08-28', inclusions: 'Plated farm-to-table dinner for 120, two wine pours per guest, service staff', notes: 'Menu tasting already completed.', source: 'sample' },
        { id: 'q-w2b', company: 'Golden Harvest Catering Co.', amount: 8600, date: '2026-08-30', inclusions: 'Family-style dinner for 120, limited bar, cake cutting', notes: 'Extra fee for late-night snack station.', source: 'sample' },
      ] },
      { id: 'v-3', name: 'Lumiere Fine Art Wedding Studios', category: 'photography', contactPerson: 'Elena Rostova', phone: '(415) 555-7721', email: 'contact@lumiereart.com', cost: 4200, status: 'deposit_paid', rating: 5, notes: 'Drone aerial flight permitted pending wind check', quotes: [
        { id: 'q-w3a', company: 'Lumiere Fine Art Wedding Studios', amount: 4200, date: '2026-08-18', inclusions: '9-hour coverage, second shooter, 4K video, drone aerials, 400 edited photos', notes: 'Travel within Napa included.', source: 'sample' },
        { id: 'q-w3b', company: 'Aperture & Oak Studio', amount: 4650, date: '2026-08-22', inclusions: '10-hour coverage, engagement mini-session, 600 photos', notes: 'No drone capability.', source: 'sample' },
      ] },
      { id: 'v-4', name: 'Botanica Flora Studio', category: 'decoration', contactPerson: 'Chloe Chen', phone: '(707) 555-4920', email: 'chloe@botanicaflora.com', cost: 3150, status: 'booked', rating: 4, notes: 'Installation begins at 12:30 PM' },
      { id: 'v-5', name: 'Golden State Sound & String Quartet', category: 'entertainment', contactPerson: 'Julian Vance', phone: '(510) 555-9018', email: 'julian@goldenstatesound.com', cost: 2600, status: 'booked', rating: 5, notes: 'Requires two power outlets near ceremony lawn' },
      { id: 'v-6', name: 'Sweet Heritage Custom Patisserie', category: 'cake', contactPerson: 'Amara Bell', phone: '(707) 555-3211', email: 'amara@sweetheritage.com', cost: 720, status: 'deposit_paid', rating: 5, notes: 'Delivery scheduled for 3:00 PM before heat peaks' },
    ],
    guests: [
      { id: 'guest-w1', name: 'Eleanor Vance', email: 'eleanor.vance@email.com', phone: '(415) 555-0182', group: 'family', rsvp: 'attending', plusOnes: 1, meal: 'standard', notes: 'Grandmother of the bride — reserve aisle-side accessible seating.' },
      { id: 'guest-w2', name: 'Marco Rossi', email: 'marco.rossi@email.com', phone: '(707) 555-0234', group: 'family', rsvp: 'attending', plusOnes: 1, meal: 'vegetarian', notes: 'Flying in from Milan with Sofia; bringing their toddler.' },
      { id: 'guest-w3', name: 'Priya & Arjun Nair', email: 'priya.nair@email.com', phone: '(408) 555-0771', group: 'friends', rsvp: 'attending', plusOnes: 0, meal: 'vegan', notes: 'Requested the vegan tasting plate from the vineyard menu.' },
      { id: 'guest-w4', name: 'Chloe Beaumont', email: 'chloe.b@email.com', phone: '(707) 555-4920', group: 'friends', rsvp: 'attending', plusOnes: 0, meal: 'gluten-free', notes: 'Venue coordinator\'s daughter — seated away from the service table.' },
      { id: 'guest-w5', name: 'Uncle Dev Patel', email: 'dev.patel@email.com', phone: '(650) 555-0310', group: 'family', rsvp: 'maybe', plusOnes: 0, meal: 'standard', notes: 'Overseas until early November — chasing for a final answer.' },
      { id: 'guest-w6', name: 'Hannah & Tom Whitfield', email: 'hannah.whitfield@email.com', phone: '(206) 555-0155', group: 'friends', rsvp: 'maybe', plusOnes: 1, meal: 'standard', notes: 'Due around the wedding date — will confirm by Oct 30.' },
      { id: 'guest-w7', name: 'Liam\'s Work Team — Studio Delta', email: 'events@studiodelta.com', phone: '(415) 555-0842', group: 'colleagues', rsvp: 'invited', plusOnes: 0, meal: 'standard', notes: 'Group invite for the groom\'s six studio colleagues.' },
      { id: 'guest-w8', name: 'Dr. Sofia Almeida', email: 'sofia.almeida@email.com', phone: '(510) 555-0221', group: 'colleagues', rsvp: 'invited', plusOnes: 0, meal: 'vegetarian', notes: 'The bride\'s thesis advisor — invitation mailed last week.' },
      { id: 'guest-w9', name: 'Grace & Ben Okafor', email: 'grace.okafor@email.com', phone: '(312) 555-0996', group: 'friends', rsvp: 'declined', plusOnes: 0, meal: 'standard', notes: 'Sent regrets — expecting their second child that month.' },
      { id: 'guest-w10', name: 'Aunt Mei Chen', email: 'mei.chen@email.com', phone: '(925) 555-0712', group: 'family', rsvp: 'attending', plusOnes: 1, meal: 'standard', notes: 'Bringing Uncle Robert — both need the shuttle from the hotel.' },
      { id: 'guest-w11', name: 'Julian Vance (DJ) +1', email: 'julian@goldenstatesound.com', phone: '(510) 555-9018', group: 'vendors', rsvp: 'attending', plusOnes: 1, meal: 'standard', notes: 'Vendor meal — setup from 4:00 PM.' },
      { id: 'guest-w12', name: 'The Hendersons (Neighbors)', email: 'henderson.family@email.com', phone: '(707) 555-0558', group: 'friends', rsvp: 'invited', plusOnes: 0, meal: 'kids', notes: 'Two kids\' meals for their twins, family of four total.' },
    ],
    invitation: {
      headline: 'Sophia & Liam invite you to their vineyard vows',
      message: 'Under the golden-hour sky of Napa Valley, we would be honored to have you witness our marriage at the Vista Winery terrace. Join us for an evening of vineyard dining, string-quartet melodies, and dancing beneath the festoon lights — the moments we will remember most are the ones shared with you.',
      signOff: 'With love & celebration, Sophia & Liam',
      rsvpDeadline: '2026-11-01',
      generatedAt: '2026-08-20T09:30:00Z',
      source: 'sample',
    },
    photos: samplePhotosFor('event-wedding-01', ['#C46851', '#7A8B7B']),
    seating: {
      tables: [
        { id: 'table-w1', name: 'Family Table', capacity: 8, seats: ['guest-w1', 'guest-w10'] },
        { id: 'table-w2', name: 'Friends of the Couple', capacity: 8, seats: ['guest-w3', 'guest-w4'] },
        { id: 'table-w3', name: 'Rossi Family Corner', capacity: 6, seats: [] },
      ],
    },
    payments: [
      { id: 'pay-w1', label: 'Napa Vista Winery — venue contract, paid in full', vendorName: 'Napa Valley Vista Winery', amount: 9500, kind: 'final', dueDate: '2026-08-15', paid: true, paidDate: '2026-08-15', notes: 'Lawn, terrace and bridal suite locked.', source: 'sample' },
      { id: 'pay-w2', label: 'Botanica Flora — floral installation balance', vendorName: 'Botanica Flora Studio', amount: 1650, kind: 'balance', dueDate: '2026-10-25', paid: false, notes: 'Final arch + 12 table runners invoice.', source: 'sample' },
      { id: 'pay-w3', label: 'Catering — final headcount balance (120 covers)', vendorName: 'Artisan Vineyard Table Catering', amount: 3900, kind: 'balance', dueDate: '2026-11-06', paid: false, notes: 'Deposit already settled; balance rides the final headcount.', source: 'sample' },
      { id: 'pay-w4', label: 'Lumiere Studios — second-half payment', vendorName: 'Lumiere Fine Art Wedding Studios', amount: 2100, kind: 'balance', dueDate: '2026-11-13', paid: false, notes: 'Due one week out with the shot list.', source: 'sample' },
      { id: 'pay-w5', label: 'Sweet Heritage — cake balance on delivery', vendorName: 'Sweet Heritage Custom Patisserie', amount: 220, kind: 'final', dueDate: '2026-11-18', paid: false, notes: 'Paid at venue hand-off, keep card ready.', source: 'sample' },
    ],
    runSheet: [
      { id: 'run-w1', time: '13:00', durationMin: 60, activity: 'Vendor load-in — venue access opens', owner: 'Venue Team', notes: 'Winery gate code 4417; carts staged by the barn.', done: false, source: 'sample' },
      { id: 'run-w2', time: '14:00', durationMin: 60, activity: 'Florals, arch garland & table runners installed', owner: 'Botanica Flora', notes: 'Detail photos before guests arrive.', done: false, source: 'sample' },
      { id: 'run-w3', time: '15:00', durationMin: 45, activity: 'Sound check — quartet & DJ changeover', owner: 'Golden State Sound', notes: 'Two power outlets by the ceremony lawn.', done: false, source: 'sample' },
      { id: 'run-w4', time: '15:45', durationMin: 15, activity: 'Wedding party ready positions', owner: 'Host', notes: 'Run-sheet copies to every owner; water station stocked.', done: false, source: 'sample' },
      { id: 'run-w5', time: '16:00', durationMin: 45, activity: 'Ceremony & vows on the terrace', owner: 'Host', notes: 'Quartet plays Canon in D; dim path lights on cue.', done: false, source: 'sample' },
      { id: 'run-w6', time: '16:45', durationMin: 45, activity: 'Golden-hour portraits', owner: 'Lumiere Studios', notes: 'Couple + families to the vineyard row; drone up if calm.', done: false, source: 'sample' },
      { id: 'run-w7', time: '17:30', durationMin: 60, activity: 'Cocktail hour on the lawn', owner: 'Catering', notes: 'Passed canapés + Cabernet flight station.', done: false, source: 'sample' },
      { id: 'run-w8', time: '18:30', durationMin: 90, activity: 'Seated dinner service', owner: 'Catering', notes: '12 tables; gluten-free and vegan plates flagged.', done: false, source: 'sample' },
      { id: 'run-w9', time: '20:00', durationMin: 30, activity: 'Toasts & speeches', owner: 'Wedding Party', notes: 'Best man, maid of honour, parents — 3 minutes each.', done: false, source: 'sample' },
      { id: 'run-w10', time: '20:30', durationMin: 90, activity: 'First dance & open floor', owner: 'Golden State Sound', notes: 'First dance: Leon Bridges; DJ takes over at 20:45.', done: false, source: 'sample' },
      { id: 'run-w11', time: '22:00', durationMin: 30, activity: 'Sparkler farewell send-off', owner: 'Host', notes: 'Sparklers distributed at 21:50; shuttle at 22:15.', done: false, source: 'sample' },
      { id: 'run-w12', time: '22:30', durationMin: 60, activity: 'Teardown & vendor load-out', owner: 'Venue Team', notes: 'Walk the meadow against the winery checklist.', done: false, source: 'sample' },
    ],
    agentRuns: [],
    gifts: [
      { id: 'gift-w1', name: 'Handcrafted Olive Wood Serving Board', store: 'Napa Home Atelier', url: '', price: 85, priority: 'high', status: 'claimed', claimedByName: 'Eleanor Vance', claimedByGuestId: 'guest-w1', notes: 'Engraved with the wedding monogram.' },
      { id: 'gift-w2', name: 'Crystal Wine Decanter & Vineyard Glass Set', store: 'Glasshouse Registry', url: '', price: 145, priority: 'high', status: 'purchased', claimedByName: 'Marco Rossi', claimedByGuestId: 'guest-w2', notes: 'Shipped from Milan.' },
      { id: 'gift-w3', name: 'Stand Mixer in Matte Sage', store: 'Culinary Depot', url: 'https://example.com/stand-mixer-sage', price: 380, priority: 'medium', status: 'available', claimedByName: '', claimedByGuestId: '', notes: 'For the pasta-making nights.' },
      { id: 'gift-w4', name: 'Weekend Vineyard Getaway Voucher', store: 'Vista Estates', url: '', price: 250, priority: 'medium', status: 'claimed', claimedByName: 'Hannah & Tom Whitfield', claimedByGuestId: 'guest-w6', notes: 'Valid for the off-season harvest weekends.' },
      { id: 'gift-w5', name: 'Espresso Machine with Milk Frother', store: 'Brew & Bean Co.', url: '', price: 420, priority: 'low', status: 'available', claimedByName: '', claimedByGuestId: '', notes: '' },
      { id: 'gift-w6', name: 'Wax-Seal Stationery & Calligraphy Kit', store: 'Paper & Post', url: '', price: 65, priority: 'low', status: 'available', claimedByName: '', claimedByGuestId: '', notes: '' },
    ],
    moodboard: {
      tiles: [
        { id: 'tile-w1', type: 'color', value: '#c46851', caption: 'Terracotta' },
        { id: 'tile-w2', type: 'color', value: '#7a8b7b', caption: 'Olive Leaf' },
        { id: 'tile-w3', type: 'color', value: '#e8d5b5', caption: 'Warm Sand' },
        { id: 'tile-w4', type: 'color', value: '#4a3b32', caption: 'Espresso Wood' },
        { id: 'tile-w5', type: 'note', value: 'Festoon string lights with amber Edison bulbs', caption: 'Lighting' },
        { id: 'tile-w6', type: 'note', value: 'Seeded eucalyptus & white ranunculus runners', caption: 'Florals' },
      ],
    },
  },
  {
    id: 'event-bday-02',
    title: "Marcus's 30th Neon Synthwave Rooftop Party",
    type: 'birthday',
    date: '2026-12-14',
    time: '20:00',
    location: 'The Velvet Sky Lounge & Arcade, Downtown Metro',
    guestCount: 55,
    budget: 6500,
    description: 'An energetic 80s retro-futuristic synthwave celebration with glowing arcade cabinets, custom laser name lights, craft mixology, and high-energy DJ sets.',
    themeName: 'Retro Neon Synthwave & Arcade',
    themeColor: '#ec4899',
    notes: 'Dress code: Neon accents, leather jackets, retro sneakers encouraged.',
    createdAt: '2026-09-10T14:00:00Z',
    expenses: [
      { id: 'exp-b1', name: 'Rooftop Lounge Private Terrace Rental', category: 'venue', allocated: 2400, spent: 2400, paid: true, date: '2026-09-20', notes: '4-hour rooftop exclusive rental with sound system.' },
      { id: 'exp-b2', name: 'Open Craft Cocktail Bar & Gourmet Sliders', category: 'catering', allocated: 2100, spent: 1950, paid: true, date: '2026-10-01', notes: 'Custom signature drink: "The Cyber Sunset".' },
      { id: 'exp-b3', name: 'Vintage Arcade Cabinets Rental (2 Units)', category: 'entertainment', allocated: 650, spent: 650, paid: true, date: '2026-10-05', notes: 'Pac-Man & Street Fighter II champion edition.' },
      { id: 'exp-b4', name: 'Custom Neon LED Sign & Laser Decor', category: 'decoration', allocated: 550, spent: 510, paid: true, date: '2026-10-12', notes: '"MARCUS LEVEL 30" custom LED acrylic sign.' },
      { id: 'exp-b5', name: 'DJ SynthWave Pulse - 3 Hour Live Set', category: 'entertainment', allocated: 800, spent: 750, paid: false, date: '2026-10-18', notes: 'Plays 80s remixed dance, retrowave, French house.' },
    ],
    tasks: [
      { id: 'task-b1', title: 'Confirm rooftop venue booking and insurance', phase: 'early', category: 'venue', dueDate: '2026-09-20', priority: 'high', completed: true, notes: 'Confirmed' },
      { id: 'task-b2', title: 'Design and send animated digital invitations', phase: 'early', category: 'stationery', dueDate: '2026-10-02', priority: 'high', completed: true, notes: 'Digital RSVP page active' },
      { id: 'task-b3', title: 'Order custom LED neon wall sign', phase: 'mid', category: 'decoration', dueDate: '2026-10-15', priority: 'medium', completed: true, notes: 'Delivered and tested' },
      { id: 'task-b4', title: 'Curate party playlist request form for guests', phase: 'mid', category: 'entertainment', dueDate: '2026-11-20', priority: 'low', completed: false, notes: 'Over 40 song suggestions received' },
      { id: 'task-b5', title: 'Pick up neon glow accessories and retro glasses', phase: 'final', category: 'miscellaneous', dueDate: '2026-12-10', priority: 'low', completed: false, notes: '50 sets purchased' },
    ],
    vendors: [
      { id: 'v-b1', name: 'Velvet Sky Rooftop', category: 'venue', contactPerson: 'Jordan Lee', phone: '(555) 018-4422', email: 'events@velvetsky.com', cost: 2400, status: 'booked', rating: 5, notes: 'Private bartender included' },
      { id: 'v-b2', name: 'RetroCade Game Rentals', category: 'entertainment', contactPerson: 'Samir Patel', phone: '(555) 019-3388', email: 'sam@retrocade.io', cost: 650, status: 'booked', rating: 5, notes: 'Delivery at 5pm' },
      { id: 'v-b3', name: 'DJ SynthWave Pulse', category: 'entertainment', contactPerson: 'Alex Rivera', phone: '(555) 012-7711', email: 'djpulse@beats.com', cost: 750, status: 'quote_received', rating: 5, notes: 'Awaiting contract sign-off', quotes: [
        { id: 'q-b3a', company: 'DJ SynthWave Pulse', amount: 750, date: '2026-10-10', inclusions: '3-hour live retrowave set, laser rig, requests line', notes: 'Holds the date for 2 weeks.', source: 'sample' },
        { id: 'q-b3b', company: 'Neon Nights DJ Collective', amount: 690, date: '2026-10-12', inclusions: '3-hour set, basic uplights, MC hosting', notes: 'No laser rig — brings mirror ball instead.', source: 'sample' },
        { id: 'q-b3c', company: 'Retrowave Sound Co.', amount: 820, date: '2026-10-14', inclusions: '4-hour set, laser + fog machine, custom edit drops', notes: 'Includes a 30-minute arcade-game remix block.', source: 'sample' },
      ] },
    ],
    guests: [
      { id: 'guest-b1', name: 'Jonas & Mira Weber', email: 'jonas.weber@email.com', phone: '(555) 201-3344', group: 'friends', rsvp: 'attending', plusOnes: 1, meal: 'standard', notes: 'Bringing retro board games for the arcade corner.' },
      { id: 'guest-b2', name: 'Aisha Thompson', email: 'aisha.t@email.com', phone: '(555) 204-8812', group: 'friends', rsvp: 'attending', plusOnes: 0, meal: 'vegetarian', notes: 'Volunteering to run the Pac-Man tournament bracket.' },
      { id: 'guest-b3', name: 'Marcus\'s Cousins (3)', email: 'kim.nguyen@email.com', phone: '(555) 207-1290', group: 'family', rsvp: 'attending', plusOnes: 2, meal: 'kids', notes: 'Group entry — Kim books for all three kids.' },
      { id: 'guest-b4', name: 'Diego Alvarez', email: 'diego.alvarez@email.com', phone: '(555) 209-4471', group: 'colleagues', rsvp: 'attending', plusOnes: 0, meal: 'standard', notes: 'Promised to bring his vintage mixtape collection.' },
      { id: 'guest-b5', name: 'Sasha & Leo Park', email: 'sasha.park@email.com', phone: '(555) 212-9950', group: 'friends', rsvp: 'maybe', plusOnes: 1, meal: 'standard', notes: 'Leo on call that weekend — confirming by Dec 1.' },
      { id: 'guest-b6', name: 'Rhythm Collective (Band Mates)', email: 'bookings@rhythmcollective.io', phone: '(555) 215-6621', group: 'colleagues', rsvp: 'invited', plusOnes: 0, meal: 'standard', notes: 'Four-piece band invite — they might sit in with the DJ.' },
      { id: 'guest-b7', name: 'Nadia Osei', email: 'nadia.osei@email.com', phone: '(555) 218-0733', group: 'friends', rsvp: 'invited', plusOnes: 0, meal: 'vegan', notes: 'Digital invite sent via the party group chat.' },
      { id: 'guest-b8', name: 'Tom & Erika Larsen', email: 'erika.larsen@email.com', phone: '(555) 220-5518', group: 'family', rsvp: 'declined', plusOnes: 0, meal: 'standard', notes: 'Overseas for the holidays — sent a neon gift instead.' },
    ],
    invitation: {
      headline: 'Marcus turns 30 — insert coin to continue',
      message: 'The rooftop goes full 80s: neon lasers, free-play arcade cabinets, and a synthwave DJ set three hours long. Grab your brightest neon accents and join us at The Velvet Sky Lounge for a night of glowing drinks, glowing dance moves, and a cake worth a high score.',
      signOff: 'Player One: Marcus',
      rsvpDeadline: '2026-11-30',
      generatedAt: '2026-10-02T18:00:00Z',
      source: 'sample',
    },
    photos: samplePhotosFor('event-bday-02', ['#F43F5E', '#06B6D4']),
    seating: {
      tables: [
        { id: 'table-b1', name: 'High Score Lounge', capacity: 6, seats: ['guest-b1', 'guest-b4'] },
        { id: 'table-b2', name: 'Neon Family Booth', capacity: 8, seats: ['guest-b3'] },
      ],
    },
    payments: [
      { id: 'pay-b1', label: 'Velvet Sky Rooftop — terrace rental, paid in full', vendorName: 'Velvet Sky Rooftop', amount: 2400, kind: 'final', dueDate: '2026-09-20', paid: true, paidDate: '2026-09-20', notes: '4-hour exclusive rental locked.', source: 'sample' },
      { id: 'pay-b2', label: 'Cocktail bar — final tab settlement', vendorName: 'Velvet Sky Rooftop', amount: 950, kind: 'balance', dueDate: '2026-12-07', paid: false, notes: 'Estimate; reconcile against the metered tab.', source: 'sample' },
      { id: 'pay-b3', label: 'DJ SynthWave Pulse — booking deposit', vendorName: 'DJ SynthWave Pulse', amount: 250, kind: 'deposit', dueDate: '2026-10-29', paid: false, notes: 'Deposit holds the 3-hour set; contract pending sign-off.', source: 'sample' },
    ],
    runSheet: [
      { id: 'run-b1', time: '17:00', durationMin: 60, activity: 'Rooftop load-in — freight elevator window', owner: 'Venue Team', notes: 'Arcade cabinets go up first.', done: false, source: 'sample' },
      { id: 'run-b2', time: '18:00', durationMin: 60, activity: 'Neon decor, LED sign & arcade setup', owner: 'RetroCade Game Rentals', notes: 'Test both cabinets on free-play mode.', done: false, source: 'sample' },
      { id: 'run-b3', time: '19:15', durationMin: 30, activity: 'DJ sound & lights check', owner: 'DJ SynthWave Pulse', notes: 'Laser positions approved by venue.', done: false, source: 'sample' },
      { id: 'run-b4', time: '19:45', durationMin: 15, activity: 'Host & co-host ready positions', owner: 'Host', notes: 'Glow accessories bin by the door.', done: false, source: 'sample' },
      { id: 'run-b5', time: '20:00', durationMin: 30, activity: 'Doors open — welcome Cyber Sunset cocktails', owner: 'Host', notes: 'Signature drink on arrival; playlist at ambience.', done: false, source: 'sample' },
      { id: 'run-b6', time: '20:30', durationMin: 45, activity: 'Pac-Man tournament bracket', owner: 'Aisha Thompson', notes: 'Bracket sheet on the LED wall; prize basket ready.', done: false, source: 'sample' },
      { id: 'run-b7', time: '21:15', durationMin: 45, activity: 'Synthwave DJ set — hour one', owner: 'DJ SynthWave Pulse', notes: 'Retrowave + French house block.', done: false, source: 'sample' },
      { id: 'run-b8', time: '22:00', durationMin: 20, activity: 'Cake cutting & LEVEL 30 toast', owner: 'Host', notes: 'Cue neon sign photo; sparkler candle.', done: false, source: 'sample' },
      { id: 'run-b9', time: '22:20', durationMin: 70, activity: 'Open dance floor & arcade free-play', owner: 'DJ SynthWave Pulse', notes: 'Requests via the party group chat.', done: false, source: 'sample' },
      { id: 'run-b10', time: '23:30', durationMin: 15, activity: 'Farewell — favors & safe-ride call', owner: 'Host', notes: 'Retro mixtape favors at the door.', done: false, source: 'sample' },
      { id: 'run-b11', time: '23:45', durationMin: 60, activity: 'Teardown & arcade load-out', owner: 'Venue Team', notes: 'Cabinets down by 00:45 per building rules.', done: false, source: 'sample' },
    ],
    agentRuns: [],
    gifts: [
      { id: 'gift-b1', name: 'Retro Handheld Game Console (300-in-1)', store: 'PixelHaus Imports', url: '', price: 95, priority: 'high', status: 'claimed', claimedByName: 'Aisha Thompson', claimedByGuestId: 'guest-b2', notes: 'Golden edition with the backlit screen.' },
      { id: 'gift-b2', name: 'Limited-Edition Synthwave Vinyl Box Set', store: 'Waveform Records', url: '', price: 120, priority: 'medium', status: 'available', claimedByName: '', claimedByGuestId: '', notes: 'Neon splatter pressing.' },
      { id: 'gift-b3', name: 'Custom Neon Bar Sign (Personalized)', store: 'GlowCraft Studio', url: '', price: 180, priority: 'low', status: 'available', claimedByName: '', claimedByGuestId: '', notes: 'For the home arcade corner.' },
    ],
    moodboard: {
      tiles: [
        { id: 'tile-b1', type: 'color', value: '#f43f5e', caption: 'Laser Pink' },
        { id: 'tile-b2', type: 'color', value: '#06b6d4', caption: 'Cyber Cyan' },
        { id: 'tile-b3', type: 'color', value: '#8b5cf6', caption: 'Neon Purple' },
        { id: 'tile-b4', type: 'color', value: '#0f172a', caption: 'Synth Black' },
        { id: 'tile-b5', type: 'note', value: 'UV blacklight photo corner with shutter-shade props', caption: 'Photos' },
      ],
    },
  },
  {
    id: 'event-comm-03',
    title: 'Oakridge Green Spring Community Carnival',
    type: 'community',
    date: '2027-03-27',
    time: '10:00',
    location: 'Oakridge Central Memorial Park, Main Meadow',
    guestCount: 350,
    budget: 9500,
    description: 'An open-air family friendly community celebration featuring local artisan vendor booths, eco-workshops, youth live music performances, and plant giveaways.',
    themeName: 'Eco-Blossom Artisan Carnival',
    themeColor: '#10b981',
    notes: 'City park permits obtained. Recycling and compost stations required.',
    createdAt: '2026-10-01T09:00:00Z',
    expenses: [
      { id: 'exp-c1', name: 'Park Pavilion & Meadow Permit', category: 'venue', allocated: 850, spent: 850, paid: true, date: '2026-10-05', notes: 'Approved by City Recreation Board.' },
      { id: 'exp-c2', name: 'Canopy Tents & Folding Tables Rental', category: 'venue', allocated: 2200, spent: 2100, paid: false, date: '2026-11-01', notes: '20 pop-up tents + 40 tables.' },
      { id: 'exp-c3', name: 'Sound System & Microphones for Band Stand', category: 'entertainment', allocated: 1200, spent: 1100, paid: false, date: '2026-11-15', notes: 'Stage audio engineering setup.' },
      { id: 'exp-c4', name: 'Kids Eco Crafts & Seed Planting Kits', category: 'miscellaneous', allocated: 900, spent: 850, paid: true, date: '2026-10-20', notes: '300 biodegradable potting cups & seeds.' },
    ],
    tasks: [
      { id: 'task-c1', title: 'Submit park usage permit application', phase: 'early', category: 'venue', dueDate: '2026-10-05', priority: 'high', completed: true, notes: 'Approved and fee paid' },
      { id: 'task-c2', title: 'Recruit local artisan vendor applicants', phase: 'early', category: 'miscellaneous', dueDate: '2026-12-01', priority: 'high', completed: true, notes: '24 artisan vendors confirmed' },
      { id: 'task-c3', title: 'Book portable restrooms & wash stations', phase: 'mid', category: 'venue', dueDate: '2027-01-15', priority: 'high', completed: false, notes: 'Quotes received from 2 vendors' },
    ],
    vendors: [
      { id: 'v-c1', name: 'Valley Event Rentals', category: 'rentals', contactPerson: 'Dave Miller', phone: '(555) 332-9011', email: 'dave@valleyrentals.com', cost: 2100, status: 'quote_received', rating: 4, notes: 'Setup morning of event at 7am', quotes: [
        { id: 'q-c1a', company: 'Valley Event Rentals', amount: 2100, date: '2026-11-20', inclusions: '20 pop-up tents + 40 folding tables, delivery and pickup', notes: 'Green-certified cleaning between uses.', source: 'sample' },
        { id: 'q-c1b', company: 'Meadow & Marquee Co.', amount: 2350, date: '2026-11-22', inclusions: '18 tents + 45 tables, onsite attendant, pickup', notes: 'Attendant stays through teardown.', source: 'sample' },
      ] },
    ],
    guests: [
      { id: 'guest-c1', name: 'Mayor Alicia Fuentes', email: 'mayor@oakridge.gov', phone: '(555) 411-0001', group: 'vip', rsvp: 'attending', plusOnes: 1, meal: 'standard', notes: 'Opening the fair at 10:00 AM — ribbon cutting at the main gate.' },
      { id: 'guest-c2', name: 'Oakridge High Brass Band (12 players)', email: 'band@oakridgehigh.edu', phone: '(555) 411-2278', group: 'vendors', rsvp: 'attending', plusOnes: 0, meal: 'standard', notes: 'Call time 9:00 AM by the bandstand; two chaperone meals.' },
      { id: 'guest-c3', name: 'GreenLeaf Co-op Artisans', email: 'hello@greenleafcoop.org', phone: '(555) 411-3390', group: 'vendors', rsvp: 'invited', plusOnes: 0, meal: 'vegetarian', notes: 'Booths B1–B6; confirm final stall map by January.' },
      { id: 'guest-c4', name: 'Coach Dana Reyes', email: 'dana.reyes@email.com', phone: '(555) 411-4412', group: 'colleagues', rsvp: 'maybe', plusOnes: 0, meal: 'standard', notes: 'Coordinating 20 youth volunteers — depends on season schedule.' },
      { id: 'guest-c5', name: 'Park Ranger Bill Hutchins', email: 'b.hutchins@parks.gov', phone: '(555) 411-5501', group: 'vip', rsvp: 'attending', plusOnes: 0, meal: 'gluten-free', notes: 'Permit officer — walkthrough at 8:00 AM, compost stations signed off.' },
    ],
    photos: samplePhotosFor('event-comm-03', ['#10B981', '#FBBF24']),
    seating: { tables: [] },
    payments: [
      { id: 'pay-c1', label: 'City park permit & pavilion fee', vendorName: 'Oakridge Parks Dept', amount: 850, kind: 'final', dueDate: '2026-10-05', paid: true, paidDate: '2026-10-05', notes: 'Approved by the Recreation Board.', source: 'sample' },
      { id: 'pay-c2', label: 'Tents & tables rental — booking deposit', vendorName: 'Valley Event Rentals', amount: 630, kind: 'deposit', dueDate: '2027-01-30', paid: false, notes: '30% holds 20 tents + 40 tables.', source: 'sample' },
      { id: 'pay-c3', label: 'Band stand audio — deposit for stage crew', vendorName: 'Oakridge Audio Co-op', amount: 550, kind: 'deposit', dueDate: '2027-02-15', paid: false, notes: 'Two engineers + PA for the day.', source: 'sample' },
      { id: 'pay-c4', label: 'Rental balance & site restoration retainer', vendorName: 'Valley Event Rentals', amount: 1470, kind: 'balance', dueDate: '2027-03-13', paid: false, notes: 'Due two weeks before the meadow date.', source: 'sample' },
    ],
    runSheet: [
      { id: 'run-c1', time: '07:00', durationMin: 30, activity: 'Site & safety walkthrough with Ranger Hutchins', owner: 'Park Ranger', notes: 'Compost and recycling stations signed off.', done: false, source: 'sample' },
      { id: 'run-c2', time: '07:30', durationMin: 90, activity: 'Tent, table & booth build-out', owner: 'Valley Event Rentals', notes: '20 tents; booth map B1–B24 posted.', done: false, source: 'sample' },
      { id: 'run-c3', time: '09:00', durationMin: 40, activity: 'Volunteer briefing & wristband handout', owner: 'Volunteer Leads', notes: 'Rotate booths every 45 minutes.', done: false, source: 'sample' },
      { id: 'run-c4', time: '09:45', durationMin: 15, activity: 'Gates, cash boxes & first-aid ready check', owner: 'Host', notes: 'QR donation signs at every gate.', done: false, source: 'sample' },
      { id: 'run-c5', time: '10:00', durationMin: 15, activity: 'Opening ribbon with Mayor Fuentes', owner: 'Host', notes: 'Brass band plays the fanfare.', done: false, source: 'sample' },
      { id: 'run-c6', time: '10:15', durationMin: 165, activity: 'Artisan booths & eco-workshops open', owner: 'Volunteers', notes: 'Seed-planting kits at the kids tent.', done: false, source: 'sample' },
      { id: 'run-c7', time: '13:00', durationMin: 60, activity: 'Main stage — youth band showcase', owner: 'Oakridge High Brass Band', notes: 'Two 25-minute sets with a changeover.', done: false, source: 'sample' },
      { id: 'run-c8', time: '15:00', durationMin: 30, activity: 'Community raffle & thank-you circle', owner: 'Host', notes: 'Announce booth winners; thank sponsors.', done: false, source: 'sample' },
      { id: 'run-c9', time: '16:00', durationMin: 30, activity: 'Soft close — plant giveaway & booth sweep', owner: 'Volunteers', notes: 'Leftover plants to the community garden.', done: false, source: 'sample' },
      { id: 'run-c10', time: '16:30', durationMin: 90, activity: 'Teardown & meadow restoration check', owner: 'Venue Team', notes: 'Ranger signs off before trucks leave.', done: false, source: 'sample' },
    ],
    agentRuns: [],
    gifts: [
      { id: 'gift-c1', name: 'Compostable Serve Ware Set (300 guests)', store: 'GreenLeaf Co-op', url: '', price: 260, priority: 'high', status: 'available', claimedByName: '', claimedByGuestId: '', notes: 'Plant-fiber plates, cups and cutlery for the food lane.' },
      { id: 'gift-c2', name: 'Meadow Restoration Tool Kit', store: 'Oakridge Garden Center', url: '', price: 140, priority: 'medium', status: 'claimed', claimedByName: 'GreenLeaf Co-op Artisans', claimedByGuestId: 'guest-c3', notes: 'For the post-fair meadow repair morning.' },
    ],
    moodboard: {
      tiles: [
        { id: 'tile-c1', type: 'color', value: '#10b981', caption: 'Leaf Green' },
        { id: 'tile-c2', type: 'color', value: '#059669', caption: 'Forest Pine' },
        { id: 'tile-c3', type: 'color', value: '#fbbf24', caption: 'Solar Gold' },
        { id: 'tile-c4', type: 'color', value: '#0284c7', caption: 'Fresh Sky' },
        { id: 'tile-c5', type: 'note', value: 'Upcycled fabric bunting between the booth lanes', caption: 'Decor' },
      ],
    },
  }
];
