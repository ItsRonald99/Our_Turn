import { vi } from 'vitest';

/**
 * Creates a chainable mock that mimics drizzle-orm's fluent query builder.
 * The entire chain is awaitable and resolves to `resolveValue`.
 *
 * Example usage:
 *   mockDb.select.mockReturnValue(makeChain([{ id: 'house-1' }]));
 *   // await db.select().from(houses).where(...).limit(1) → [{ id: 'house-1' }]
 */
export function makeChain(resolveValue) {
  const p = Promise.resolve(resolveValue);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    values: vi.fn(() => chain),
    set: vi.fn(() => chain),
    // Make the chain thenable so `await chain` works
    then: (resolve, reject) => p.then(resolve, reject),
    catch: (fn) => p.catch(fn),
    finally: (fn) => p.finally(fn),
  };
  return chain;
}

/**
 * Creates a mock drizzle db object with spy methods.
 * Use mockReturnValueOnce to queue specific results for sequential calls.
 */
export function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}
