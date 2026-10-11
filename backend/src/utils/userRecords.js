const mongoose = require('mongoose');

// Places a user can be referenced from. Models that aren't registered, and
// fields that don't exist on a model's schema, are skipped automatically, so a
// wrong guess here can never crash the server. Add more entries as needed.
const REFERENCES = [
  { model: 'Event',        label: 'projects',        fields: ['client', 'assignedFreelancers.freelancer'] },
  { model: 'Quotation',    label: 'quotations',      fields: ['client'] },
  { model: 'Payment',      label: 'payments',        fields: ['client'] },
  { model: 'Payroll',      label: 'payroll entries', fields: ['freelancer'] },
  { model: 'Meeting',      label: 'meetings',        fields: ['createdBy', 'requestedBy', 'participants'] },
  { model: 'DamageReport', label: 'damage reports',  fields: ['freelancer', 'reportedBy'] },
];

const hasPath = (schema, p) => !!schema.path(p) || !!schema.path(p.split('.')[0]);

// Returns the labels of everything that still points at this user, e.g. ['projects', 'payments'].
async function findUserRecords(userId) {
  const found = [];
  for (const ref of REFERENCES) {
    const Model = mongoose.models[ref.model];
    if (!Model) continue;
    const fields = ref.fields.filter(f => hasPath(Model.schema, f));
    if (!fields.length) continue;
    const hit = await Model.exists({ $or: fields.map(f => ({ [f]: userId })) });
    if (hit) found.push(ref.label);
  }
  return found;
}

const recordsMessage = (found) =>
  `This account still has records (${found.join(', ')}) and can't be deleted. ` +
  `Deactivate it instead to keep your history.`;

module.exports = { findUserRecords, recordsMessage };