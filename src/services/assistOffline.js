/**
 * Smart Offline Planning Engines — the always-available fallback tier.
 *
 * When the live GenAI engine is unreachable (offline demo, API hiccup, rate
 * limit), every AI panel still produces genuinely useful, parameter-driven
 * output from these pure generators. No network, no latency, no dead ends.
 *
 * All functions mirror the normalized shapes returned by /api/ai/assist so the
 * UI components never care which tier answered.
 */

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const todayStr = () => new Date().toISOString().slice(0, 10);

/** YYYY-MM-DD minus `days` (clamped so results never precede today). */
function dateMinusDays(dateStr, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return todayStr();
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return todayStr();
  d.setDate(d.getDate() - Math.max(0, Math.round(days)));
  const floor = new Date(`${todayStr()}T12:00:00`);
  if (d < floor) return todayStr();
  return d.toISOString().slice(0, 10);
}

const EVENT_LABELS = {
  wedding: 'wedding',
  birthday: 'birthday party',
  community: 'community event',
  anniversary: 'anniversary',
  gala: 'charity gala',
  babyshower: 'baby shower',
  other: 'celebration',
};

/* ------------------------------------------------------------------ */
/* 1. Budget plan                                                     */
/* ------------------------------------------------------------------ */

const BUDGET_TEMPLATES = {
  wedding: [
    ['Venue & Rentals', 35], ['Catering & Beverages', 28], ['Photography & Video', 12],
    ['Decoration & Florals', 8], ['Entertainment & Music', 7], ['Attire & Beauty', 6],
    ['Invitations & Favors', 2], ['Contingency', 2],
  ],
  birthday: [
    ['Venue & Rentals', 25], ['Catering & Beverages', 30], ['Entertainment & Music', 18],
    ['Decoration & Florals', 12], ['Photography & Video', 6], ['Cake & Desserts', 5], ['Contingency', 4],
  ],
  community: [
    ['Venue & Permits', 30], ['Catering & Beverages', 25], ['Equipment & Rentals', 15],
    ['Entertainment & Music', 10], ['Safety & First Aid', 8], ['Signage & Printing', 6], ['Contingency', 6],
  ],
  default: [
    ['Venue & Rentals', 30], ['Catering & Beverages', 25], ['Entertainment & Music', 15],
    ['Decoration & Florals', 10], ['Photography & Video', 10], ['Contingency', 10],
  ],
};

const BUDGET_TIPS = {
  wedding: [
    'Book venue + catering together — bundled quotes often save 10-15% on the two biggest lines.',
    'Marry off-season or on a Sunday: venue rates can drop 20-30% for identical service.',
    'Use in-season local flowers and greenery instead of imported blooms to cut floral costs by a third.',
    'Ask photographers for digital-only packages; albums can be ordered later once cash flow recovers.',
  ],
  birthday: [
    'Time the party 2-5pm so guests arrive after lunch — cake and snacks replace a full meal.',
    'Rent one hero bounce house or entertainer instead of several small attractions.',
    'DIY the photo booth: a phone tripod plus props delivers 90% of the fun for 10% of the cost.',
    'Order a semi-custom bakery cake and add supermarket florals for the display tier.',
  ],
  community: [
    'Ask the municipality about free/low-cost public space permits for community gatherings.',
    'Partner with local businesses for sponsorships in exchange for banners and shout-outs.',
    'Borrow tables, chairs, and PA equipment from schools or community centers instead of renting.',
    'Recruit volunteers via neighborhood apps — food vouchers cost far less than hired staff.',
  ],
  default: [
    'Lock the venue first — every other quote depends on knowing the space.',
    'Get at least 3 itemized quotes per category; the spread usually reveals 10-20% savings.',
    'Hold 10% of the budget as an untouchable contingency until the final week.',
    'Pay deposits by card where possible for fraud protection and easier refunds.',
  ],
};

/**
 * @returns {{ headline: string, allocations: {category:string,percent:number,rationale:string}[], tips: string[] }}
 */
export function offlineBudgetPlan({ eventType = 'other', totalBudget = 5000, guestCount = 50 } = {}) {
  const label = EVENT_LABELS[eventType] || EVENT_LABELS.other;
  const template = BUDGET_TEMPLATES[eventType] || BUDGET_TEMPLATES.default;
  const perGuest = guestCount > 0 ? Math.round(totalBudget / guestCount) : totalBudget;

  const allocations = template.map(([category, percent]) => ({
    category,
    percent,
    rationale: `${money(totalBudget * percent / 100)} — about ${percent}% of the budget for a ${label}, scaling with ${money(perGuest)}/guest.`,
  }));

  const tips = BUDGET_TIPS[eventType] || BUDGET_TIPS.default;

  return {
    headline: `A ${label} with ${guestCount} guests at ${money(totalBudget)} works best when venue + catering take ~${template[0][1] + (template[1]?.[1] || 0)}% of spend.`,
    allocations,
    tips,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Timeline plan                                                   */
/* ------------------------------------------------------------------ */

const TIMELINE_TEMPLATES = {
  wedding: [
    ['Book the venue and sign the contract', 180, 'high', 'venue', 'Dates vanish 6+ months out — lock yours before anything else.'],
    ['Hire caterer and finalize the menu', 150, 'high', 'catering', 'Tasting sessions and contracts take weeks; secure your favorites.'],
    ['Book photographer and videographer', 120, 'high', 'photography', 'Good wedding photographers book a year ahead — don\'t lose your shortlist.'],
    ['Order attire and book hair & makeup', 90, 'medium', 'attire', 'Alterations alone need 4-6 weeks, so order early.'],
    ['Send save-the-dates / invitations', 75, 'medium', 'stationery', 'Guests need runway to arrange travel and time off.'],
    ['Book florals, cake, and entertainment', 60, 'medium', 'decoration', 'Confirm delivery windows and setup responsibilities in writing.'],
    ['Final headcount to caterer & seating chart', 14, 'high', 'logistics', 'Caterers bill on final numbers — late changes cost money.'],
    ['Confirm vendor arrival times and day-of schedule', 7, 'medium', 'logistics', 'Share a single timeline sheet with every vendor contact.'],
    ['Marriage license and final payments', 3, 'high', 'logistics', 'Licenses have waiting periods — check local rules this week.'],
  ],
  birthday: [
    ['Pick the theme and set the date', 28, 'high', 'venue', 'Theme drives every decoration and food decision after it.'],
    ['Book venue or reserve the space', 21, 'high', 'venue', 'Indoor backups matter for seasonal parties.'],
    ['Order the cake and plan the menu', 14, 'medium', 'catering', 'Bakeries need ~1 week notice for custom designs.'],
    ['Send invitations and track RSVPs', 12, 'medium', 'stationery', 'Headcount drives food, favors, and seating.'],
    ['Buy decorations, favors, and party supplies', 10, 'low', 'decoration', 'Online orders need buffer time for shipping surprises.'],
    ['Book entertainer or plan activities & playlist', 7, 'medium', 'entertainment', 'Confirm setup needs: power, space, sound check.'],
    ['Prep goody bags and confirm helpers', 2, 'low', 'logistics', 'Assign each helper one concrete job for party day.'],
  ],
  community: [
    ['Confirm date and reserve the venue/space', 56, 'high', 'venue', 'Public spaces need permit lead time — file paperwork first.'],
    ['Submit permits, insurance, and safety plan', 49, 'high', 'logistics', 'Municipal approvals can take weeks; follow up weekly.'],
    ['Recruit volunteers and assign team leads', 42, 'high', 'logistics', 'People commit earlier when roles are concrete.'],
    ['Book vendors: food trucks, sound, rentals', 35, 'medium', 'catering', 'Popular food trucks book community events 1+ month out.'],
    ['Launch publicity: flyers, local groups, boards', 28, 'medium', 'stationery', 'Weekly reminders build momentum better than one blast.'],
    ['Finalize layout: booths, stage, first-aid, flow', 14, 'high', 'logistics', 'Crowd flow prevents most day-of incidents.'],
    ['Volunteer briefing and equipment check', 2, 'high', 'logistics', 'Radio/channel list + weather plan everyone can repeat.'],
  ],
  default: [
    ['Set the date and lock the venue', 45, 'high', 'venue', 'Everything downstream schedules around this decision.'],
    ['Draft the guest list and send invites', 30, 'medium', 'stationery', 'RSVPs drive catering counts and seating.'],
    ['Book core vendors: catering, photo, sound', 25, 'high', 'catering', 'Get itemized quotes and read cancellation clauses.'],
    ['Plan decor and order supplies', 14, 'low', 'decoration', 'Keep a shared shopping list so nothing doubles up.'],
    ['Confirm final headcount with all vendors', 7, 'high', 'logistics', 'Late number changes usually trigger fees.'],
    ['Day-of checklist: timings, contacts, backups', 2, 'medium', 'logistics', 'Print it — phones die at the worst moments.'],
  ],
};

/**
 * @returns {{ headline: string, tasks: {title,description,dueDate,priority,category}[] }}
 */
export function offlineTimelinePlan({ eventType = 'other', eventDate = todayStr(), daysUntilEvent = 60, tone = '' } = {}) {
  const template = TIMELINE_TEMPLATES[eventType] || TIMELINE_TEMPLATES.default;

  // Compress the template when the real runway is shorter than the template's span.
  const span = Math.max(1, template[0][1]);
  const factor = daysUntilEvent > 0 ? Math.min(1, daysUntilEvent / span) : 0.05;

  const tasks = template
    .map(([title, offsetDays, priority, category, description]) => ({
      title,
      description: tone && description ? `${description} Keep it ${tone}.` : description,
      dueDate: dateMinusDays(eventDate, Math.max(1, Math.round(offsetDays * factor))),
      priority,
      category,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const label = EVENT_LABELS[eventType] || EVENT_LABELS.other;
  return {
    headline:
      daysUntilEvent > 0
        ? `${daysUntilEvent} days out: work this ${label} checklist top-down, bookings first.`
        : 'Event day is here — focus only on the day-of logistics.',
    tasks,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Vendor plan                                                     */
/* ------------------------------------------------------------------ */

const VENDOR_TEMPLATES = {
  wedding: [
    ['Venue', 'Sets the date, capacity, and 40% of the visual mood.', 0.35],
    ['Catering', 'Largest per-guest cost driver; tastings book out months ahead.', 0.28],
    ['Photography', 'The only artifact you keep after the day — book the best you can afford.', 0.12],
    ['Florist', 'Ceremony arch + tablescapes carry the aesthetic.', 0.08],
    ['Music / DJ', 'Reads the room and runs the timeline on the night.', 0.07],
    ['Cake', 'Doubles as dessert course and photo centerpiece.', 0.03],
  ],
  birthday: [
    ['Venue', 'Weatherproof space sized to the guest count.', 0.25],
    ['Catering', 'Kid-friendly crowd-pleasers beat adventurous menus.', 0.28],
    ['Entertainer', 'The hero memory — magician, bounce house, or character.', 0.18],
    ['Bakery & Cake', 'Custom cakes need ~1 week lead time.', 0.06],
    ['Decorator', 'Balloon garlands and backdrops photograph beautifully.', 0.1],
    ['Photographer', 'You should be in the pictures, not behind the camera.', 0.06],
  ],
  community: [
    ['Venue / Permits', 'Legal foundation — start the paperwork before spending anything.', 0.3],
    ['Catering / Food Trucks', 'The attendance magnet; book popular trucks early.', 0.22],
    ['Equipment Rentals', 'Stage, sound, tables, and power distribution.', 0.15],
    ['Security', 'Required by most permits above certain crowd sizes.', 0.08],
    ['First Aid', 'A visible station keeps everyone safer and reassured.', 0.05],
    ['Waste & Cleanup', 'Leave the space cleaner than you found it — protects future events.', 0.04],
  ],
  default: [
    ['Venue', 'Lock date and capacity first.', 0.3],
    ['Catering', 'Feeds the moment — get 3 quotes.', 0.25],
    ['Photography', 'Memories outlive the party.', 0.1],
    ['Entertainment', 'Sets energy and pace.', 0.12],
    ['Rentals', 'Tables, chairs, sound for the crowd size.', 0.1],
  ],
};

const VENDOR_QUESTIONS = [
  'What dates around our target are still open, and what is the deposit to hold one?',
  'Is the quote itemized — delivery, setup, overtime, and teardown included or extra?',
  'What is your cancellation and refund policy in writing?',
  'Do you carry liability insurance, and can you send proof?',
  'Have you worked this venue type/crowd size before — can we see a reference?',
  'What exactly do you need from us on the day (power, space, helpers, parking)?',
];

/**
 * Fuzzy category-overlap test so "Entertainment" matches "Entertainer",
 * "Photography" matches "Photographer", etc. Words match when one starts
 * with the other, or both share a 7+ character prefix (stem-style match).
 */
const wordsOf = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

function categoriesOverlap(labelA, labelB) {
  const a = wordsOf(labelA);
  const b = wordsOf(labelB);
  if (!a.length || !b.length) return false;
  for (const wa of a) {
    for (const wb of b) {
      if (wa === wb) return true;
      if (wa.startsWith(wb) || wb.startsWith(wa)) return true;
      if (wa.length >= 7 && wb.length >= 7 && wa.slice(0, 7) === wb.slice(0, 7)) return true;
    }
  }
  return false;
}

/**
 * @returns {{ headline: string, suggestions: {category,why,estCostRange}[], questions: string[] }}
 */
export function offlineVendorPlan({ eventType = 'other', totalBudget = 5000, existingCategories = [] } = {}) {
  const template = VENDOR_TEMPLATES[eventType] || VENDOR_TEMPLATES.default;

  const suggestions = template
    .filter(([category]) => !existingCategories.some((covered) => categoriesOverlap(covered, category)))
    .map(([category, why, share]) => ({
      category,
      why,
      estCostRange: `${money(totalBudget * share * 0.8)} – ${money(totalBudget * share * 1.2)} typical`,
    }))
    .slice(0, 5);

  // When the plan is nearly complete, surface the universally useful extras.
  if (suggestions.length === 0) {
    suggestions.push({
      category: 'Day-of Coordinator',
      why: 'Even fully-booked plans need one brain running the schedule.',
      estCostRange: `${money(totalBudget * 0.08)} – ${money(totalBudget * 0.12)} typical`,
    });
  }

  return {
    headline: suggestions.length
      ? `Close these ${suggestions.length} vendor gap${suggestions.length === 1 ? '' : 's'} to de-risk the day.`
      : 'Your vendor bench is complete — consider a coordinator to run the day.',
    suggestions,
    questions: VENDOR_QUESTIONS,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Vendor inquiry draft                                            */
/* ------------------------------------------------------------------ */

/**
 * @returns {{ subject: string, message: string }}
 */
export function offlineVendorInquiry({
  vendorName = 'there',
  vendorCategory = 'services',
  eventTitle = 'our celebration',
  eventType = 'other',
  eventDate = '',
  location = '',
  guestCount = 0,
  estCost = 0,
} = {}) {
  const label = EVENT_LABELS[eventType] || EVENT_LABELS.other;
  const subject = `Inquiry: ${vendorCategory} for "${eventTitle}"${eventDate ? ` on ${eventDate}` : ''}`;

  const lines = [
    `Hello ${vendorName},`,
    '',
    `We are planning ${eventTitle}, a ${label}${location ? ` taking place at ${location}` : ''}${eventDate ? ` on ${eventDate}` : ''}${guestCount ? `, with roughly ${guestCount} guests` : ''}, and we would love to work with you.`,
    '',
    'Could you let us know:',
    '1. Whether you are available on that date,',
    `2. An itemized quote${estCost ? ` (we have budgeted around ${money(estCost)} for this category)` : ''},`,
    '3. Your deposit, payment schedule, and cancellation policy.',
    '',
    'If helpful, we can hop on a quick call this week. Thank you for your time — we look forward to hearing from you.',
    '',
    'Warm regards,',
  ].join('\n');

  return { subject, message: lines };
}

/* ------------------------------------------------------------------ */
/* 5. Plan review                                                     */
/* ------------------------------------------------------------------ */

/**
 * Rule-based readiness audit mirroring the AI review shape.
 * @returns {{ summary: string, score: number, strengths: string[], risks: string[], nextActions: string[] }}
 */
export function offlinePlanReview({
  eventTitle = 'Your celebration',
  eventType = 'other',
  daysUntilEvent = 0,
  totalBudget = 0,
  spentSoFar = 0,
  guestCount = 0,
  taskStats = { total: 0, completed: 0 },
  vendorStats = { total: 0, booked: 0 },
  unbookedCategories = [],
} = {}) {
  const label = EVENT_LABELS[eventType] || EVENT_LABELS.other;
  const strengths = [];
  const risks = [];
  const actions = [];

  const taskPct = taskStats.total > 0 ? taskStats.completed / taskStats.total : 0;
  const vendorPct = vendorStats.total > 0 ? vendorStats.booked / vendorStats.total : 1;
  const spentPct = totalBudget > 0 ? spentSoFar / totalBudget : 0;

  // Score: weighted readiness blended from real plan data.
  let score = Math.round(taskPct * 40 + vendorPct * 30 + 25);
  if (spentPct > 1) score -= 25;
  else if (spentPct > 0.85) score -= 10;
  if (daysUntilEvent < 0) score = Math.min(score, 35);
  if (daysUntilEvent >= 0 && daysUntilEvent <= 14 && vendorPct < 0.6) score -= 15;
  score = Math.max(0, Math.min(100, score));

  if (taskStats.total === 0) {
    risks.push('No tasks logged yet — the plan exists only in your head.');
    actions.push('Generate a milestone timeline in the Timeline tab (the AI can draft one).');
  } else if (taskPct >= 0.7) {
    strengths.push(`${taskStats.completed} of ${taskStats.total} milestones already done — strong execution pace.`);
  } else {
    risks.push(`Only ${taskStats.completed} of ${taskStats.total} tasks complete with ${daysUntilEvent >= 0 ? `${daysUntilEvent} days` : 'the event past'} remaining.`);
    actions.push('Pick the two incomplete tasks with the nearest due dates and clear them this week.');
  }

  if (vendorStats.total === 0) {
    risks.push('No vendors tracked — book the venue before anything else.');
    actions.push('Add your first vendor, then run the AI Vendor Advisor for the missing categories.');
  } else if (vendorPct >= 0.8) {
    strengths.push(`${vendorStats.booked} of ${vendorStats.total} vendors booked — the day is locked in.`);
  } else {
    risks.push(
      unbookedCategories.length
        ? `Still unbooked: ${unbookedCategories.slice(0, 4).join(', ')}${unbookedCategories.length > 4 ? ', …' : ''}.`
        : `${vendorStats.total - vendorStats.booked} vendor(s) not yet booked.`
    );
    actions.push('Contact the highest-cost unbooked vendor today and request an itemized quote.');
  }

  if (spentPct > 1) {
    risks.push(`Over budget by ${money(spentSoFar - totalBudget)} — the remaining spend plan must be cut.`);
    actions.push('Open the Budget tab and use the AI Copilot to rebalance allocations.');
  } else if (spentPct > 0.85) {
    risks.push(`${Math.round(spentPct * 100)}% of the budget is already committed — little room for surprises.`);
    actions.push('Freeze new non-essential spend until the final headcount is confirmed.');
  } else if (totalBudget > 0) {
    strengths.push(`Budget healthy: ${money(totalBudget - spentSoFar)} still unallocated of ${money(totalBudget)}.`);
  }

  if (daysUntilEvent > 0 && daysUntilEvent <= 30) {
    actions.push(`With ${daysUntilEvent} days left, send a consolidated day-of schedule to every booked vendor.`);
  }

  if (strengths.length === 0) {
    strengths.push(`The bones of "${eventTitle}" exist — everything from here is sequencing.`);
  }
  if (risks.length === 0) {
    risks.push('No red flags detected — stay on the current cadence.');
  }
  if (actions.length === 0) {
    actions.push('Keep ticking milestones — you are on track for a smooth celebration.');
  }

  const summaryText = `Readiness score ${score}/100 for your ${label}${daysUntilEvent >= 0 ? `, ${daysUntilEvent} days out` : ''}: ${score >= 70 ? 'on track' : score >= 40 ? 'needs attention in a few areas' : 'at risk — act on the top items now'}.`;

  return {
    summary: summaryText,
    score,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    nextActions: actions.slice(0, 5),
  };
}

/* ------------------------------------------------------------------ */
/* 6. Assistant chat                                                  */
/* ------------------------------------------------------------------ */

/**
 * Rule-based responder using the live event facts. Handles the high-intent
 * questions users actually ask; everything else gets a capable steer-back.
 * @returns {{ reply: string, suggestions: string[] }}
 */
export function offlineAssistantChat({
  message = '',
  eventTitle = 'your celebration',
  eventType = 'other',
  eventDate = '',
  daysUntilEvent = 0,
  totalBudget = 0,
  spentSoFar = 0,
  guestCount = 0,
  taskStats = { total: 0, completed: 0 },
  vendorStats = { total: 0, booked: 0 },
  unbookedCategories = [],
} = {}) {
  const q = String(message).toLowerCase();
  const label = EVENT_LABELS[eventType] || EVENT_LABELS.other;
  const remaining = Math.max(0, totalBudget - spentSoFar);

  const budgetReply = `You have ${money(remaining)} left of your ${money(totalBudget)} budget for "${eventTitle}" (${money(spentSoFar)} committed so far). ${spentSoFar / Math.max(1, totalBudget) > 0.85 ? 'That is tight — hold new spend until final headcount.' : 'That is a healthy buffer.'} The Budget tab's AI Copilot can rebalance categories if a quote came in high.`;

  const timelineReply = daysUntilEvent >= 0
    ? `"${eventTitle}" is ${daysUntilEvent} days away (${eventDate || 'date TBD'}). You have completed ${taskStats.completed} of ${taskStats.total} milestones. Next best move: ${taskStats.total === 0 ? 'generate an AI milestone plan in the Timeline tab.' : 'open the Timeline tab and clear the nearest-due task today.'}`
    : `"${eventTitle}" is dated ${eventDate || 'in the past'}. If it already happened, log any leftover costs; if the date slipped, update it in Event Details and re-run the AI plan review.`;

  const vendorReply = vendorStats.total === 0
    ? `No vendors are tracked yet for "${eventTitle}". Start with the venue — it anchors the date and capacity — then run the AI Vendor Advisor in the Vendors tab for the missing categories.`
    : `${vendorStats.booked} of ${vendorStats.total} vendors are booked${unbookedCategories.length ? `, with ${unbookedCategories.slice(0, 3).join(', ')} still open` : ''}. Use the AI inquiry drafts in the Vendors tab to contact them with the sharp questions already written.`;

  const ideasReply = `For a ${label} like "${eventTitle}", the AI Theme Studio (Sparkles tab) generates full concepts — palette, decor, music, and catering direction tuned to your ${money(totalBudget)} budget and ${guestCount || 'guest'} count. You can apply any concept to the event in one click.`;

  let reply;
  if (/budget|money|cost|spend|afford|cheap|save|over\b/.test(q)) reply = budgetReply;
  else if (/timeline|task|deadline|when|next|due|schedule|plan/.test(q)) reply = timelineReply;
  else if (/vendor|supplier|caterer|photographer|venue|book/.test(q)) reply = vendorReply;
  else if (/idea|theme|decor|music|food|menu|creative|inspiration/.test(q)) reply = ideasReply;
  else reply = `I can help with the budget, timeline, vendors, or creative ideas for "${eventTitle}". Ask me anything — for example "how is my budget looking?" or "what should I do next?" — or open the AI panels in each tab for deeper help.`;

  return {
    reply,
    suggestions: ['How is my budget looking?', 'What should I do next?', 'Which vendors am I missing?'],
  };
}
