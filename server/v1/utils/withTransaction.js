const mongoose = require("mongoose");

/**
 * Runs `fn(session)` inside a MongoDB multi-document transaction.
 *
 * Uses session.withTransaction() which automatically:
 *  - Retries the entire callback on TransientTransactionError
 *  - Retries the commit on UnknownTransactionCommitResult
 *  - Aborts and rethrows any other error
 *
 * Usage:
 *   const result = await withTransaction(async (session) => {
 *     await ModelA.updateMany({...}, {...}, { session });
 *     await ModelB.bulkWrite([...], { session });
 *     return someValue; // optional return
 *   });
 *
 * @template T
 * @param {(session: mongoose.ClientSession) => Promise<T>} fn
 * @returns {Promise<T>}
 */

async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
