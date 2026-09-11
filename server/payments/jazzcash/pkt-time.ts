const PKT_OFFSET_MILLISECONDS = 5 * 60 * 60 * 1000; // UTC+05:00, no DST
const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** Format a Date instant as JazzCash's YYYYMMDDHHMMSS in Pakistan Standard Time. */
export function formatPktTimestamp(date: Date): string {
  const pkt = new Date(date.getTime() + PKT_OFFSET_MILLISECONDS);
  return (
    `${pkt.getUTCFullYear()}${pad(pkt.getUTCMonth() + 1)}${pad(pkt.getUTCDate())}` +
    `${pad(pkt.getUTCHours())}${pad(pkt.getUTCMinutes())}${pad(pkt.getUTCSeconds())}`
  );
}

/** Add exactly 24 hours to a Date instant for transaction expiry. */
export function addOneDay(date: Date): Date {
  return new Date(date.getTime() + ONE_DAY_MILLISECONDS);
}
