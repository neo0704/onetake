/**
 * dateHelpers.js
 * All date logic tied to event dates so nothing falls outside the event's timeframe.
 */

/** Format a Date to yyyy-MM-dd for <input type="date"> */
export const toInputDate = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  return date.toISOString().slice(0, 10);
};

/** Format a Date to yyyy-MM-ddTHH:mm for <input type="datetime-local"> */
export const toInputDateTime = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  return date.toISOString().slice(0, 16);
};

/** Add N days to a date */
export const addDays = (d, n) => {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
};

/**
 * Quotation valid-until:
 * Auto = min(event date - 3 days, today + 14 days)
 * Client must confirm at least 3 days before event.
 */
export const calcQuotationValidUntil = (eventDate) => {
  if (!eventDate) {
    return toInputDate(addDays(new Date(), 14));
  }
  const evDate      = new Date(eventDate);
  const threeDaysBefore = addDays(evDate, -3);
  const fourteenDaysOut = addDays(new Date(), 14);
  // Pick whichever is earlier
  const validUntil  = threeDaysBefore < fourteenDaysOut ? threeDaysBefore : fourteenDaysOut;
  // But never in the past
  const today = new Date();
  today.setHours(0,0,0,0);
  return toInputDate(validUntil < today ? today : validUntil);
};

/**
 * Meeting date constraints relative to an event.
 * Meetings should happen BEFORE the event (for planning) or ON the event day.
 * min = today, max = event date
 */
export const meetingDateConstraints = (eventDate) => {
  const today = toInputDate(new Date());
  const max   = eventDate ? toInputDate(new Date(eventDate)) : '';
  return { min: today, max };
};

/**
 * Payroll period constraints relative to an event.
 * Period should be within a window around the event date.
 * Suggest: periodFrom = event date, periodTo = event date (1-day event)
 * Admin can extend, but min/max kept sensible.
 */
export const payrollPeriodDefaults = (eventDate) => {
  if (!eventDate) return { periodFrom: '', periodTo: '' };
  const evDate = new Date(eventDate);
  return {
    periodFrom: toInputDate(evDate),
    periodTo:   toInputDate(evDate),
  };
};

/**
 * Payroll period min/max:
 * min = 30 days before event (setup/prep time)
 * max = 7 days after event (post-production)
 */
export const payrollPeriodConstraints = (eventDate) => {
  if (!eventDate) return { min: '', max: '' };
  const evDate = new Date(eventDate);
  return {
    min: toInputDate(addDays(evDate, -30)),
    max: toInputDate(addDays(evDate, 7)),
  };
};

/**
 * Inquiry / Event date:
 * min = tomorrow (can't book same day)
 * no max
 */
export const eventDateMin = () => {
  return toInputDate(addDays(new Date(), 1));
};

/**
 * Given an event date string, returns a human-readable deadline string.
 * e.g. "April 17, 2026 (3 days before event)"
 */
export const formatDeadline = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};
