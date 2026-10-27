import { describe, expect, test } from 'bun:test';
import {
  HISTORY_LIMIT,
  pushUndo,
  recordEdit,
  computeUndo,
  computeRedo,
  summarizeHistory,
} from '../../src/lib/history/historyStack';

/* Snapshots are opaque array references — identity is what matters. */
const A = [{ id: 'a' }];
const B = [{ id: 'b' }];
const C = [{ id: 'c' }];

describe('pushUndo', () => {
  test('appends immutably and never mutates the input stack', () => {
    const before: unknown[] = [A];
    const after = pushUndo(before, B);
    expect(after).toEqual([A, B]);
    expect(before).toHaveLength(1);
  });

  test('caps the stack at the configured limit, dropping the OLDEST snapshots', () => {
    let stack: unknown[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      stack = pushUndo(stack, { i });
    }
    expect(stack).toHaveLength(HISTORY_LIMIT);
    // The newest snapshot survives; the first five are gone.
    expect((stack[stack.length - 1] as { i: number }).i).toBe(HISTORY_LIMIT + 4);
    expect((stack[0] as { i: number }).i).toBe(5);
  });

  test('handles non-array stacks defensively', () => {
    expect(pushUndo(null, A)).toEqual([A]);
    expect(pushUndo(undefined, undefined)).toEqual([]);
  });
});

describe('recordEdit', () => {
  test('stores the pre-change snapshot and clears the redo branch', () => {
    const state = { undoStack: [A], redoStack: [C] };
    const next = recordEdit(state, B);
    expect(next.undoStack).toEqual([A, B]);
    expect(next.redoStack).toEqual([]);
  });
});

describe('computeUndo', () => {
  test('pops the newest undo snapshot and moves current onto the redo stack', () => {
    const step = computeUndo({ undoStack: [A, B], redoStack: [] }, C);
    expect(step).not.toBeNull();
    expect(step!.next).toBe(B);
    expect(step!.undoStack).toEqual([A]);
    expect(step!.redoStack).toEqual([C]);
  });

  test('returns null when there is nothing to undo', () => {
    expect(computeUndo({ undoStack: [], redoStack: [] }, A)).toBeNull();
    expect(computeUndo({ undoStack: null as never, redoStack: [] }, A)).toBeNull();
  });
});

describe('computeRedo', () => {
  test('pops the newest redo snapshot and pushes current back onto undo', () => {
    const step = computeRedo({ undoStack: [A], redoStack: [B, C] }, A);
    expect(step).not.toBeNull();
    expect(step!.next).toBe(C);
    expect(step!.undoStack).toEqual([A, A]);
    expect(step!.redoStack).toEqual([B]);
  });

  test('returns null when there is nothing to redo', () => {
    expect(computeRedo({ undoStack: [A], redoStack: [] }, B)).toBeNull();
  });
});

describe('summarizeHistory', () => {
  test('drives the Navbar disabled states', () => {
    expect(summarizeHistory({ undoStack: [], redoStack: [] })).toEqual({ canUndo: false, canRedo: false });
    expect(summarizeHistory({ undoStack: [A], redoStack: [] })).toEqual({ canUndo: true, canRedo: false });
    expect(summarizeHistory({ undoStack: [], redoStack: [B] })).toEqual({ canUndo: false, canRedo: true });
    expect(summarizeHistory({ undoStack: [A], redoStack: [B] })).toEqual({ canUndo: true, canRedo: true });
  });
});

describe('full undo/redo cycle', () => {
  test('undo then redo returns to the same state references', () => {
    let undoStack: unknown[] = [];
    let redoStack: unknown[] = [];
    let current = A;

    // Edit 1: A -> B
    ({ undoStack, redoStack } = recordEdit({ undoStack, redoStack }, current));
    current = B;
    // Edit 2: B -> C
    ({ undoStack, redoStack } = recordEdit({ undoStack, redoStack }, current));
    current = C;
    expect(undoStack).toEqual([A, B]);

    // Undo C -> B
    const step1 = computeUndo({ undoStack, redoStack }, current)!;
    undoStack = step1.undoStack;
    redoStack = step1.redoStack;
    current = step1.next;
    expect(current).toBe(B);

    // Undo B -> A
    const step2 = computeUndo({ undoStack, redoStack }, current)!;
    undoStack = step2.undoStack;
    redoStack = step2.redoStack;
    current = step2.next;
    expect(current).toBe(A);
    expect(summarizeHistory({ undoStack, redoStack }).canUndo).toBe(false);

    // Redo A -> B
    const step3 = computeRedo({ undoStack, redoStack }, current)!;
    undoStack = step3.undoStack;
    redoStack = step3.redoStack;
    current = step3.next;
    expect(current).toBe(B);

    // A NEW edit after undo discards the redo branch.
    ({ undoStack, redoStack } = recordEdit({ undoStack, redoStack }, current));
    current = [{ id: 'new' }];
    expect(redoStack).toEqual([]);
  });
});
