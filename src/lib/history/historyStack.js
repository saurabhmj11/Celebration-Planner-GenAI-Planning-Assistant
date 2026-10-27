/**
 * Undo/redo history engine — pure, unit-testable.
 *
 * The app keeps ONE source of truth (the `events` array in EventContext), so
 * history can be snapshot-based: every committed change stores the previous
 * array reference (state updates never mutate, so snapshots stay valid
 * without deep copies). This module owns all of the rules — the context only
 * wires refs + effects around it.
 *
 * Semantics (classic two-stack):
 *   - recordEdit: push the pre-change snapshot on the undo stack, clear redo.
 *   - undo: move the current state onto the redo stack and restore the top
 *     undo snapshot.
 *   - redo: move the current state back onto the undo stack and restore the
 *     top redo snapshot.
 * A brand-new edit always discards the redo branch (like every editor).
 */

/** How many past states we keep. 50 keeps typical planning sessions fully covered. */
export const HISTORY_LIMIT = 50;

/** Immutable push onto the undo stack with the size cap applied. */
export function pushUndo(undoStack, snapshot, limit = HISTORY_LIMIT) {
  if (!Array.isArray(undoStack)) return snapshot === undefined ? [] : [snapshot];
  const next = [...undoStack, snapshot];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/**
 * Register a committed edit: `snapshot` is the state BEFORE the change.
 * Always discards the redo branch — history is linear from here on.
 */
export function recordEdit({ undoStack, redoStack }, snapshot, limit = HISTORY_LIMIT) {
  return {
    undoStack: pushUndo(undoStack, snapshot, limit),
    redoStack: [],
  };
}

/**
 * Compute an undo step without touching inputs.
 * Returns { next, undoStack, redoStack } or null when nothing to undo.
 */
export function computeUndo({ undoStack, redoStack }, current) {
  if (!Array.isArray(undoStack) || undoStack.length === 0) return null;
  const previous = undoStack[undoStack.length - 1];
  return {
    next: previous,
    undoStack: undoStack.slice(0, -1),
    redoStack: [...(Array.isArray(redoStack) ? redoStack : []), current],
  };
}

/**
 * Compute a redo step without touching inputs.
 * Returns { next, undoStack, redoStack } or null when nothing to redo.
 */
export function computeRedo({ undoStack, redoStack }, current) {
  if (!Array.isArray(redoStack) || redoStack.length === 0) return null;
  const next = redoStack[redoStack.length - 1];
  return {
    next,
    undoStack: [...(Array.isArray(undoStack) ? undoStack : []), current],
    redoStack: redoStack.slice(0, -1),
  };
}

/** UI-facing availability flags. */
export function summarizeHistory({ undoStack, redoStack }) {
  return {
    canUndo: Array.isArray(undoStack) && undoStack.length > 0,
    canRedo: Array.isArray(redoStack) && redoStack.length > 0,
  };
}
