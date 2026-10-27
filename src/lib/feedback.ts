/**
 * Feedback configuration and status helpers for Payana Mitra trails.
 * Handles Google Form links and post-trail submission timing windows.
 */

export type FeedbackConfig = {
  url: string | null;
  windowDays: number;
};

export type FeedbackState = "not_configured" | "upcoming" | "open" | "closed";

export type FeedbackStatus = {
  configured: boolean;
  formUrl: string | null;
  windowDays: number;
  state: FeedbackState;
  opensOnDate: string | null;
  closesOnDate: string | null;
  daysRemaining: number;
  hoursRemaining: number;
  isFinished: boolean;
};

const FEEDBACK_TAG_REGEX = /<!--pm_feedback:([\s\S]*?)-->/;

/**
 * Extracts feedback configuration from a trip record.
 * Prioritizes native columns (feedback_form_url, feedback_window_days),
 * with backward-compatible fallback to embedded remarks metadata if the migration
 * hasn't been applied yet.
 */
export function extractFeedbackConfig(trip: {
  remarks?: string | null;
  feedback_form_url?: string | null;
  feedback_window_days?: number | null;
}): FeedbackConfig {
  if (trip.feedback_form_url !== undefined && trip.feedback_form_url !== null) {
    const rawUrl = String(trip.feedback_form_url).trim();
    const rawDays = Number(trip.feedback_window_days);
    return {
      url: rawUrl || null,
      windowDays: Number.isFinite(rawDays) && rawDays > 0 ? Math.round(rawDays) : 7,
    };
  }

  // Fallback: check remarks for embedded config
  if (trip.remarks) {
    const match = trip.remarks.match(FEEDBACK_TAG_REGEX);
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        return {
          url: parsed.url ? String(parsed.url).trim() : null,
          windowDays: Number.isFinite(Number(parsed.windowDays)) && Number(parsed.windowDays) > 0 ? Math.round(Number(parsed.windowDays)) : 7,
        };
      } catch {
        // ignore parse error
      }
    }
  }

  return {
    url: null,
    windowDays: 7,
  };
}

/**
 * Strips internal feedback metadata tags from remarks so user-facing text is clean.
 */
export function cleanRemarks(remarks?: string | null): string {
  if (!remarks) return "";
  return remarks.replace(FEEDBACK_TAG_REGEX, "").trim();
}

/**
 * Embeds feedback config into remarks string as a fallback when native columns are not available.
 */
export function embedFeedbackConfigIntoRemarks(
  remarks: string | null | undefined,
  config: FeedbackConfig,
): string {
  const base = cleanRemarks(remarks);
  if (!config.url) {
    return base;
  }
  const meta = JSON.stringify({ url: config.url, windowDays: config.windowDays });
  return base ? `${base}\n<!--pm_feedback:${meta}-->` : `<!--pm_feedback:${meta}-->`;
}

function parseDateOnly(dateStr: string): { year: number; month: number; day: number } | null {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  return null;
}

function formatDateString(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculates whether feedback is open, upcoming, or closed based on trail end_date and window days.
 * Feedback opens when the trail concludes (on end_date) and closes windowDays later at 23:59:59.
 */
export function calculateFeedbackStatus(trip: {
  start_date?: string | null;
  end_date?: string | null;
  feedback_form_url?: string | null;
  feedback_window_days?: number | null;
  remarks?: string | null;
}): FeedbackStatus {
  const config = extractFeedbackConfig(trip);

  // Need end_date (or start_date) to determine completion
  const effectiveEndStr = trip.end_date || trip.start_date;
  if (!effectiveEndStr) {
    return {
      configured: Boolean(config.url),
      formUrl: config.url,
      windowDays: config.windowDays,
      state: "upcoming",
      opensOnDate: "Upon trail conclusion",
      closesOnDate: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      isFinished: false,
    };
  }

  const parsedEnd = parseDateOnly(effectiveEndStr);
  if (!parsedEnd) {
    return {
      configured: Boolean(config.url),
      formUrl: config.url,
      windowDays: config.windowDays,
      state: "upcoming",
      opensOnDate: null,
      closesOnDate: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      isFinished: false,
    };
  }

  const now = new Date();
  const openDate = new Date(parsedEnd.year, parsedEnd.month, parsedEnd.day, 0, 0, 0, 0);
  const closeDate = new Date(
    parsedEnd.year,
    parsedEnd.month,
    parsedEnd.day + config.windowDays,
    23,
    59,
    59,
    999,
  );

  const opensOnDate = formatDateString(openDate);
  const closesOnDate = formatDateString(closeDate);

  if (now < openDate) {
    // Trail has not reached its end date yet
    return {
      configured: Boolean(config.url),
      formUrl: config.url,
      windowDays: config.windowDays,
      state: "upcoming",
      opensOnDate,
      closesOnDate,
      daysRemaining: 0,
      hoursRemaining: 0,
      isFinished: false,
    };
  }

  if (now > closeDate) {
    // Trail ended and the fixed window has elapsed
    return {
      configured: Boolean(config.url),
      formUrl: config.url,
      windowDays: config.windowDays,
      state: "closed",
      opensOnDate,
      closesOnDate,
      daysRemaining: 0,
      hoursRemaining: 0,
      isFinished: true,
    };
  }

  // Trail is finished and inside the active feedback window
  const diffMs = closeDate.getTime() - now.getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const closeMidnight = new Date(parsedEnd.year, parsedEnd.month, parsedEnd.day + config.windowDays).getTime();
  const daysRemaining = Math.max(0, Math.round((closeMidnight - todayMidnight) / 86400000));
  const hoursRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

  return {
    configured: Boolean(config.url),
    formUrl: config.url,
    windowDays: config.windowDays,
    state: "open",
    opensOnDate,
    closesOnDate,
    daysRemaining,
    hoursRemaining,
    isFinished: true,
  };
}
