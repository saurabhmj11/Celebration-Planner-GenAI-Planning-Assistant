// Default categories, preset themes, and rich initial sample data for Celebration & Event Planner

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
      { id: 'v-2', name: 'Artisan Vineyard Table Catering', category: 'catering', contactPerson: 'Chef Mateo Rossi', phone: '(707) 555-8314', email: 'mateo@vineyardtable.com', cost: 7800, status: 'booked', rating: 5, notes: 'Special gluten-free and vegan plates arranged' },
      { id: 'v-3', name: 'Lumiere Fine Art Wedding Studios', category: 'photography', contactPerson: 'Elena Rostova', phone: '(415) 555-7721', email: 'contact@lumiereart.com', cost: 4200, status: 'deposit_paid', rating: 5, notes: 'Drone aerial flight permitted pending wind check' },
      { id: 'v-4', name: 'Botanica Flora Studio', category: 'decoration', contactPerson: 'Chloe Chen', phone: '(707) 555-4920', email: 'chloe@botanicaflora.com', cost: 3150, status: 'booked', rating: 4, notes: 'Installation begins at 12:30 PM' },
      { id: 'v-5', name: 'Golden State Sound & String Quartet', category: 'entertainment', contactPerson: 'Julian Vance', phone: '(510) 555-9018', email: 'julian@goldenstatesound.com', cost: 2600, status: 'booked', rating: 5, notes: 'Requires two power outlets near ceremony lawn' },
      { id: 'v-6', name: 'Sweet Heritage Custom Patisserie', category: 'cake', contactPerson: 'Amara Bell', phone: '(707) 555-3211', email: 'amara@sweetheritage.com', cost: 720, status: 'deposit_paid', rating: 5, notes: 'Delivery scheduled for 3:00 PM before heat peaks' },
    ]
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
      { id: 'v-b3', name: 'DJ SynthWave Pulse', category: 'entertainment', contactPerson: 'Alex Rivera', phone: '(555) 012-7711', email: 'djpulse@beats.com', cost: 750, status: 'quote_received', rating: 5, notes: 'Awaiting contract sign-off' },
    ]
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
      { id: 'v-c1', name: 'Valley Event Rentals', category: 'rentals', contactPerson: 'Dave Miller', phone: '(555) 332-9011', email: 'dave@valleyrentals.com', cost: 2100, status: 'quote_received', rating: 4, notes: 'Setup morning of event at 7am' },
    ]
  }
];
