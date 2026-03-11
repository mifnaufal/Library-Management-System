function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDateUTC(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function getMonthRangeUtc(now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from: toIsoDateUTC(start), to: toIsoDateUTC(end) };
}

module.exports = { getMonthRangeUtc };

