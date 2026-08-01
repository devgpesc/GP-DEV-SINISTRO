import { Event, EventStatus, Priority } from '../types';

export type DeadlineState =
  | 'Sem prazo'
  | 'Dentro do prazo'
  | 'Proximo do vencimento'
  | 'Vencendo hoje'
  | 'Atrasado'
  | 'Concluido dentro do prazo'
  | 'Concluido em atraso';

const DAY_MS = 24 * 60 * 60 * 1000;

export const PRIORITY_SCORE_MIN = 1;
export const PRIORITY_SCORE_MAX = 10;

export function normalizePriorityScore(score?: number | null, priority?: Priority | string | null) {
  const numeric = Number(score);
  if (Number.isFinite(numeric) && numeric >= PRIORITY_SCORE_MIN && numeric <= PRIORITY_SCORE_MAX) {
    return Math.round(numeric);
  }

  if (priority === Priority.LOW || priority === 'Baixa') return 2;
  if (priority === Priority.MEDIUM || priority === 'Média' || priority === 'Media') return 5;
  if (priority === Priority.HIGH || priority === 'Alta') return 8;
  if (priority === Priority.URGENT || priority === 'Urgente') return 9;
  return 5;
}

export function classifyPriorityScore(score?: number | null): Priority {
  const normalized = normalizePriorityScore(score);
  if (normalized <= 3) return Priority.LOW;
  if (normalized <= 7) return Priority.MEDIUM;
  return Priority.URGENT;
}

export function getPriorityLabel(score?: number | null, fallback?: Priority | string | null) {
  return classifyPriorityScore(normalizePriorityScore(score, fallback));
}

export function getPriorityTone(priority?: Priority | string | null) {
  const normalized = priority === Priority.URGENT || priority === Priority.HIGH ? Priority.URGENT : priority;
  if (normalized === Priority.LOW) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (normalized === Priority.URGENT) return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function getDeadlineInfo(input: {
  openedAt?: string | null;
  deadlineAt?: string | null;
  status?: EventStatus | string | null;
  nearThresholdDays?: number;
}) {
  const opened = input.openedAt ? new Date(input.openedAt) : null;
  const deadline = input.deadlineAt ? new Date(input.deadlineAt) : null;
  const today = startOfDay(new Date());
  const nearThresholdDays = input.nearThresholdDays ?? 2;
  const completed = input.status === EventStatus.COMPLETED || input.status === 'Concluído';

  if (!deadline || Number.isNaN(deadline.getTime())) {
    return {
      state: 'Sem prazo' as DeadlineState,
      daysElapsed: opened && !Number.isNaN(opened.getTime()) ? Math.max(0, Math.floor((today.getTime() - startOfDay(opened).getTime()) / DAY_MS)) : 0,
      daysRemaining: null as number | null,
      totalDays: null as number | null,
      usedPercent: 0,
      isNear: false,
      isOverdue: false,
    };
  }

  const deadlineDay = startOfDay(deadline);
  const openedDay = opened && !Number.isNaN(opened.getTime()) ? startOfDay(opened) : today;
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - openedDay.getTime()) / DAY_MS));
  const daysRemaining = Math.ceil((deadlineDay.getTime() - today.getTime()) / DAY_MS);
  const totalDays = Math.max(1, Math.ceil((deadlineDay.getTime() - openedDay.getTime()) / DAY_MS));
  const usedPercent = Math.max(0, Math.min(100, Math.round((daysElapsed / totalDays) * 100)));
  const isOverdue = daysRemaining < 0;
  const isToday = daysRemaining === 0;
  const isNear = !isOverdue && daysRemaining <= nearThresholdDays;

  let state: DeadlineState = 'Dentro do prazo';
  if (completed) state = isOverdue ? 'Concluido em atraso' : 'Concluido dentro do prazo';
  else if (isOverdue) state = 'Atrasado';
  else if (isToday) state = 'Vencendo hoje';
  else if (isNear) state = 'Proximo do vencimento';

  return { state, daysElapsed, daysRemaining, totalDays, usedPercent, isNear, isOverdue };
}

export function getDeadlineTone(state: DeadlineState) {
  if (state.includes('Atrasado') || state === 'Vencendo hoje') return 'bg-red-50 text-red-700 border-red-100';
  if (state === 'Proximo do vencimento') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (state.includes('Concluido')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  if (state === 'Dentro do prazo') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
}

export function getAutomaticPriorityEscalation(event: Event, nearThresholdDays = 2) {
  const currentScore = normalizePriorityScore(event.priority_score, event.priority);
  const currentPriority = classifyPriorityScore(currentScore);
  const deadline = getDeadlineInfo({
    openedAt: event.opened_at || (event as any).created_at || event.createdAt,
    deadlineAt: event.deadline_at,
    status: event.status,
    nearThresholdDays,
  });

  if (deadline.isOverdue && currentPriority !== Priority.URGENT) {
    return {
      priority: Priority.URGENT,
      priorityScore: Math.max(currentScore, 9),
      reason: 'Sinistro atrasado pela data limite.',
      deadline,
    };
  }

  if (deadline.isNear && currentPriority === Priority.LOW) {
    return {
      priority: Priority.MEDIUM,
      priorityScore: Math.max(currentScore, 5),
      reason: 'Sinistro proximo do vencimento.',
      deadline,
    };
  }

  if (deadline.isNear && currentPriority === Priority.MEDIUM) {
    return {
      priority: Priority.URGENT,
      priorityScore: Math.max(currentScore, 8),
      reason: 'Sinistro medio proximo do vencimento.',
      deadline,
    };
  }

  return null;
}
