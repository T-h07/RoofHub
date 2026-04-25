export const MESSAGING_SECTIONS = ["outer_company", "in_company"] as const;

export type MessagingSection = (typeof MESSAGING_SECTIONS)[number];

export function normalizeMessagingSection(
  value: string | null | undefined,
  fallback: MessagingSection = "outer_company"
): MessagingSection {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();
  if ((MESSAGING_SECTIONS as readonly string[]).includes(normalizedValue)) {
    return normalizedValue as MessagingSection;
  }

  return fallback;
}

export function isMessagingSection(value: string | null | undefined): value is MessagingSection {
  if (typeof value !== "string") {
    return false;
  }

  return (MESSAGING_SECTIONS as readonly string[]).includes(value.trim().toLowerCase());
}

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

const SHORT_DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
});

export const MESSAGING_INBOX_LANES = ["all", "assigned", "queue"] as const;

export type MessagingInboxLane = (typeof MESSAGING_INBOX_LANES)[number];

export function normalizeMessagingInboxLane(
  value: string | null | undefined,
  fallback: MessagingInboxLane = "all"
): MessagingInboxLane {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (
    (MESSAGING_INBOX_LANES as readonly string[]).includes(normalizedValue)
  ) {
    return normalizedValue as MessagingInboxLane;
  }

  return fallback;
}

function parseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isYesterday(value: Date, now: Date) {
  const previousDay = new Date(now);
  previousDay.setDate(now.getDate() - 1);

  return isSameCalendarDay(value, previousDay);
}

export function formatConversationActivityLabel(value: string, now = new Date()) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "--";
  }

  const diffMilliseconds = now.getTime() - parsed.getTime();
  if (diffMilliseconds < 0) {
    return SHORT_DATE_FORMATTER.format(parsed);
  }

  const diffSeconds = Math.floor(diffMilliseconds / 1000);
  if (diffSeconds < 60) {
    return "Now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  if (isYesterday(parsed, now)) {
    return "Yesterday";
  }

  if (parsed.getFullYear() === now.getFullYear()) {
    return SHORT_DATE_FORMATTER.format(parsed);
  }

  return SHORT_DATE_WITH_YEAR_FORMATTER.format(parsed);
}

export function formatConversationActivityTitle(value: string) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "Unknown activity timestamp";
  }

  return SHORT_DATE_WITH_YEAR_FORMATTER.format(parsed);
}

export function formatMessageTimeLabel(value: string) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "--";
  }

  return MESSAGE_TIME_FORMATTER.format(parsed);
}

export function formatMessageDayLabel(value: string, now = new Date()) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "Unknown date";
  }

  if (isSameCalendarDay(parsed, now)) {
    return "Today";
  }

  if (isYesterday(parsed, now)) {
    return "Yesterday";
  }

  if (parsed.getFullYear() === now.getFullYear()) {
    return SHORT_DATE_FORMATTER.format(parsed);
  }

  return SHORT_DATE_WITH_YEAR_FORMATTER.format(parsed);
}

export function areMessagesOnSameDay(leftIso: string, rightIso: string) {
  const leftDate = parseDate(leftIso);
  const rightDate = parseDate(rightIso);

  if (!leftDate || !rightDate) {
    return false;
  }

  return isSameCalendarDay(leftDate, rightDate);
}
