const Meeting = require('../models/Meeting');

const GRACE_MS = Meeting.GRACE_MINUTES * 60000;

/**
 * Flips any 'requested' or 'scheduled' meeting whose window (scheduledAt +
 * duration + grace) has passed over to 'expired'.
 *
 * Mongo can't compare against a per-document `duration` field in a plain
 * query, so this uses an aggregation-style $expr to compute each meeting's
 * own end time rather than assuming a fixed length.
 *
 * Safe to call often — it only ever touches documents that actually match.
 */
async function expireStaleMeetings() {
  const result = await Meeting.updateMany(
    {
      status: { $in: ['requested', 'scheduled'] },
      manuallyReactivated: { $ne: true },
      $expr: {
        $lt: [
          {
            $add: [
              '$scheduledAt',
              { $multiply: [{ $ifNull: ['$duration', 60] }, 60000] },
              GRACE_MS,
            ],
          },
          new Date(),
        ],
      },
    },
    { $set: { status: 'expired' } }
  );

  return result.modifiedCount || 0;
}

module.exports = { expireStaleMeetings };