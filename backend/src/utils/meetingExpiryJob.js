const cron = require('node-cron');
const { expireStaleMeetings } = require('./expireMeetings');

/**
 * Runs the expiry sweep every 5 minutes.
 *
 * The on-read sweep in GET /api/meetings already covers the common case,
 * but that only fires when someone opens the meetings page. This makes the
 * lock happen regardless — which matters because the socket join-guard and
 * any notifications should reflect reality even if nobody's looking.
 *
 * Call startMeetingExpiryJob() once, after the DB connection is up.
 */
function startMeetingExpiryJob() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await expireStaleMeetings();
      if (count > 0) console.log(`[MEETINGS] Expired ${count} stale meeting(s)`);
    } catch (err) {
      console.error('[MEETINGS] Expiry sweep failed:', err.message);
    }
  });

  console.log('[MEETINGS] Expiry job scheduled (every 5 min)');
}

module.exports = { startMeetingExpiryJob };