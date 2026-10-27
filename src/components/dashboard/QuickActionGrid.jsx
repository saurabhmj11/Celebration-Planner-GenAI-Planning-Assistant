import { Wallet, Clock, Users, Sparkles, MapPinned, CalendarClock, UserPlus, Images, Bot, ClipboardList } from 'lucide-react';

export const QuickActionGrid = ({
  onAddExpense,
  onAddTask,
  onAddVendor,
  onOpenAiStudio,
  onFindVenue,
  onEditEvent,
  onManageGuests,
  onSharePhotos,
  onOpenAgentForce,
  onOpenDayOf,
}) => {
  const actions = [
    {
      label: 'Agent Force',
      description: 'Deploy AI agents to draft your day-of plan',
      icon: Bot,
      color: 'from-fuchsia-600 to-brand-600 text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100',
      badge: 'NEW',
      action: onOpenAgentForce,
    },
    {
      label: 'Day-Of Plan',
      description: 'Run sheet, seating chart & payments',
      icon: ClipboardList,
      color: 'from-indigo-500 to-violet-600 text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
      badge: 'Day-Of',
      action: onOpenDayOf,
    },
    {
      label: 'Edit Plan',
      description: 'Change date, guests, budget or venue',
      icon: CalendarClock,
      color: 'from-sky-600 to-indigo-600 text-sky-600 bg-sky-50 hover:bg-sky-100',
      badge: 'Plan',
      action: onEditEvent,
    },
    {
      label: 'Add Expense',
      description: 'Record vendor invoice or deposit',
      icon: Wallet,
      color: 'from-brand-600 to-fuchsia-600 text-brand-600 bg-brand-50 hover:bg-brand-100',
      badge: 'Budget',
      action: onAddExpense,
    },
    {
      label: 'Add Task',
      description: 'Create milestone or deadline',
      icon: Clock,
      color: 'from-brand-500 to-fuchsia-600 text-brand-600 bg-brand-50 hover:bg-brand-100',
      badge: 'Timeline',
      action: onAddTask,
    },
    {
      label: 'Add Vendor',
      description: 'Log caterer, photo, or DJ quote',
      icon: Users,
      color: 'from-rose-600 to-pink-600 text-rose-600 bg-rose-50 hover:bg-rose-100',
      badge: 'Vendors',
      action: onAddVendor,
    },
    {
      label: 'AI Theme Studio',
      description: 'Generate decor, palette & vibe ideas',
      icon: Sparkles,
      color: 'from-amber-500 to-orange-500 text-amber-600 bg-amber-50 hover:bg-amber-100',
      badge: 'GenAI',
      action: onOpenAiStudio,
    },
    {
      label: 'Invite Guests',
      description: 'Guest list, RSVPs & AI invitation cards',
      icon: UserPlus,
      color: 'from-emerald-600 to-teal-600 text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
      badge: 'RSVP',
      action: onManageGuests,
    },
    {
      label: 'Photo Wall',
      description: 'Upload & share celebration memories',
      icon: Images,
      color: 'from-fuchsia-500 to-rose-500 text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100',
      badge: 'Share',
      action: onSharePhotos,
    },
    {
      label: 'AI Venue Finder',
      description: 'Ranked venues + map, photos & booking',
      icon: MapPinned,
      color: 'from-brand-500 to-fuchsia-500 text-brand-600 bg-brand-50 hover:bg-brand-100',
      badge: 'New',
      action: onFindVenue,
    },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900">Quick Actions</h3>
          <p className="text-xs text-slate-500">Fast shortcuts to manage your celebration planning</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {actions.map((act, index) => {
          const Icon = act.icon;
          return (
            <button
              key={index}
              onClick={act.action}
              className="flex flex-col items-start p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/80 transition-all text-left group shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className={`p-2.5 rounded-xl ${act.color} transition-transform group-hover:scale-110`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {act.badge}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-800 group-hover:text-brand-600 transition-colors">
                {act.label}
              </h4>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{act.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
