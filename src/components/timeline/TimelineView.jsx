import React, { useState, useMemo } from 'react';
import { useEventContext } from '../../context/EventContext';
import { TIMELINE_PHASES, BUDGET_CATEGORIES } from '../../data/defaultData';
import { calculateTimelineStats, getDueDateUrgency } from '../../utils/calculator';
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Edit2,
  Trash2,
  Sparkles
} from 'lucide-react';

export const TimelineView = ({ onOpenTaskModal, onEditTask }) => {
  const { activeEvent, toggleTaskComplete, deleteTask } = useEventContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, pending, completed

  const tasks = useMemo(() => activeEvent?.tasks || [], [activeEvent?.tasks]);
  const { totalTasks, completedTasks, progressPct } = useMemo(
    () => calculateTimelineStats(tasks),
    [tasks]
  );

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPhase = selectedPhase === 'all' || t.phase === selectedPhase;
      const matchesPriority = selectedPriority === 'all' || t.priority === selectedPriority;
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'completed' && t.completed) ||
        (selectedStatus === 'pending' && !t.completed);
      return matchesSearch && matchesPhase && matchesPriority && matchesStatus;
    });
  }, [tasks, searchTerm, selectedPhase, selectedPriority, selectedStatus]);

  // Group tasks by phase for structured presentation
  const groupedTasks = useMemo(() => {
    return TIMELINE_PHASES.map((phase) => {
      const phaseTasks = filteredTasks.filter((t) => t.phase === phase.id);
      return {
        ...phase,
        tasks: phaseTasks,
      };
    }).filter((g) => g.tasks.length > 0 || selectedPhase === g.id);
  }, [filteredTasks, selectedPhase]);

  const getDueDateStatus = (dueDateStr, isCompleted) => getDueDateUrgency(dueDateStr, isCompleted);

  if (!activeEvent) return null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
              Event Timeline & Milestones
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200">
              {completedTasks} / {totalTasks} Completed
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track key milestones, assign priority deadlines, and ensure seamless celebration execution
          </p>
        </div>

        <button
          onClick={onOpenTaskModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Milestone Task</span>
        </button>
      </div>

      {/* Progress Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Milestone Completion Rate
            </span>
            <span className="text-sm font-extrabold text-brand-700">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-600 to-fuchsia-600 h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              <strong>{completedTasks}</strong> tasks finished
            </span>
            <span>
              <strong>{totalTasks - completedTasks}</strong> pending milestones
            </span>
          </div>
        </div>

        {progressPct === 100 && totalTasks > 0 && (
          <div className="shrink-0 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>All milestones finished! Ready for celebration!</span>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search milestone tasks by keyword..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="all">All Phases</option>
                {TIMELINE_PHASES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setSelectedStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus('pending')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === 'pending' ? 'bg-white shadow-sm text-brand-800' : 'text-slate-600'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setSelectedStatus('completed')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === 'completed' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600'
                }`}
              >
                Completed
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="all">All Priorities</option>
                <option value="high">🔥 High Priority</option>
                <option value="medium">⚡ Medium Priority</option>
                <option value="low">🌱 Low Priority</option>
              </select>
            </div>
          </div>
        </div>

        {/* Timeline Phased Groups */}
        {groupedTasks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Clock className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No milestone tasks found</p>
            <p className="text-xs text-slate-400">
              {searchTerm || selectedPhase !== 'all' || selectedPriority !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Click "+ Add Milestone Task" to start scheduling your celebration timeline'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {groupedTasks.map((group) => {
              if (group.tasks.length === 0) return null;
              const groupCompleted = group.tasks.filter((t) => t.completed).length;

              return (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-600" />
                      {group.label}
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {groupCompleted} of {group.tasks.length} done
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {group.tasks.map((task) => {
                      const cat = BUDGET_CATEGORIES.find((c) => c.id === task.category);
                      const dueStatus = getDueDateStatus(task.dueDate, task.completed);

                      return (
                        <div
                          key={task.id}
                          className={`flex items-start sm:items-center justify-between p-4 rounded-2xl border transition-all ${
                            task.completed
                              ? 'bg-slate-50/60 border-slate-200/60 opacity-80'
                              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleTaskComplete(task.id)}
                              className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 sm:mt-0 ${
                                task.completed
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/25'
                                  : 'border-slate-300 hover:border-brand-500 bg-white'
                              }`}
                            >
                              {task.completed && <CheckCircle2 className="w-4 h-4" />}
                            </button>

                            {/* Task details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={`text-xs sm:text-sm font-bold ${
                                    task.completed
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {task.title}
                                </p>

                                {/* Priority Badge */}
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    task.priority === 'high'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : task.priority === 'low'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {task.priority}
                                </span>

                                {/* Category Tag */}
                                {cat && (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <span>{cat.icon}</span>
                                    <span>{cat.label}</span>
                                  </span>
                                )}
                              </div>

                              {task.notes && (
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                  {task.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Due Date & Actions */}
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            {task.dueDate && (
                              <div className="hidden md:flex flex-col items-end">
                                <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {task.dueDate}
                                </span>
                                {dueStatus && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border mt-0.5 ${dueStatus.color}`}
                                  >
                                    {dueStatus.label}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onEditTask(task)}
                                title="Edit Task"
                                className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete task "${task.title}"?`)) {
                                    deleteTask(task.id);
                                  }
                                }}
                                title="Delete Task"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
