const mongoose = require('mongoose');

// A project counts as "finished" once it is fully paid or cancelled.
// Everything else (inquiries, quotations, confirmed, assigned, in progress,
// completed but balance still unpaid...) blocks deleting the account.
// Add any other end-state your app uses (e.g. 'declined') to this list.
const FINISHED_STATUSES = ['completed_paid', 'cancelled'];

// How many unfinished projects involve this user, as the client or as an assigned freelancer.
async function countUnfinishedProjects(userId) {
  const Event = mongoose.models.Event;
  // Fail safe: if the model isn't loaded, refuse to delete rather than silently allow it.
  if (!Event) throw new Error('Event model is not registered; cannot check projects before deleting');
  return Event.countDocuments({
    status: { $nin: FINISHED_STATUSES },
    $or: [{ client: userId }, { 'assignedFreelancers.freelancer': userId }],
  });
}

const unfinishedMessage = (n) =>
  `This account has ${n} project${n > 1 ? 's' : ''} that ${n > 1 ? "aren't" : "isn't"} finished yet, so it can't be deleted. ` +
  `Finish or cancel ${n > 1 ? 'them' : 'it'} first, or deactivate the account instead.`;

module.exports = { countUnfinishedProjects, unfinishedMessage, FINISHED_STATUSES };