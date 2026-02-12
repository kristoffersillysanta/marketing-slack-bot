// Service account credentials interface
export interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

// Format date as YYYY-MM-DD using local timezone (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get ISO week number
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Get same day last year
export function getSameDayLastYear(date: Date): { start: string; end: string } {
  const lastYear = new Date(date);
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  const dateStr = formatLocalDate(lastYear);
  return { start: dateStr, end: dateStr };
}

// Get same week last year (ISO week)
export function getSameWeekLastYear(weekNumber: number, currentYear: number): { start: string; end: string } {
  // Find the first day of the ISO week in the previous year
  const jan4 = new Date(currentYear - 1, 0, 4); // Jan 4 is always in week 1
  const dayOfWeek = jan4.getDay() || 7; // Sunday = 7
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1); // Go to Monday of week 1

  // Add weeks to get to target week
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetMonday.getDate() + 6);

  return {
    start: formatLocalDate(targetMonday),
    end: formatLocalDate(targetSunday),
  };
}

// Get same month last year
export function getSameMonthLastYear(month: number, year: number): { start: string; end: string } {
  const lastYear = year - 1;
  const startDate = new Date(lastYear, month, 1);
  const endDate = new Date(lastYear, month + 1, 0); // Last day of month

  return {
    start: formatLocalDate(startDate),
    end: formatLocalDate(endDate),
  };
}

// Get quarter period (quarter: 1-4)
export function getQuarterPeriod(quarter: number, year: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
  const endMonth = startMonth + 2; // Q1=2, Q2=5, Q3=8, Q4=11

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0); // Last day of end month

  return {
    start: formatLocalDate(startDate),
    end: formatLocalDate(endDate),
  };
}

// Get same quarter last year
export function getSameQuarterLastYear(quarter: number, year: number): { start: string; end: string } {
  return getQuarterPeriod(quarter, year - 1);
}

// Get previous quarter info (for quarterly reports run after quarter ends)
export function getPreviousQuarterPeriod(): {
  quarter: number;
  year: number;
  start: string;
  end: string
} {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11

  // Determine which quarter just ended based on current month
  // Jan-Mar (0-2) = Q4 of last year just ended
  // Apr-Jun (3-5) = Q1 of this year just ended
  // Jul-Sep (6-8) = Q2 of this year just ended
  // Oct-Dec (9-11) = Q3 of this year just ended

  let quarter: number;
  let year: number;

  if (currentMonth >= 0 && currentMonth <= 2) {
    // January-March: Q4 of last year
    quarter = 4;
    year = now.getFullYear() - 1;
  } else if (currentMonth >= 3 && currentMonth <= 5) {
    // April-June: Q1 of this year
    quarter = 1;
    year = now.getFullYear();
  } else if (currentMonth >= 6 && currentMonth <= 8) {
    // July-September: Q2 of this year
    quarter = 2;
    year = now.getFullYear();
  } else {
    // October-December: Q3 of this year
    quarter = 3;
    year = now.getFullYear();
  }

  const period = getQuarterPeriod(quarter, year);

  return {
    quarter,
    year,
    ...period,
  };
}

// Get previous month period
export function getPreviousMonthPeriod(): { start: string; end: string; month: number; year: number } {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    start: formatLocalDate(prevMonth),
    end: formatLocalDate(lastDay),
    month: prevMonth.getMonth(),
    year: prevMonth.getFullYear(),
  };
}

// Get month period for a specific month/year
export function getMonthPeriod(month: number, year: number): { start: string; end: string } {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month

  return {
    start: formatLocalDate(startDate),
    end: formatLocalDate(endDate),
  };
}

// Helper to get date strings for periods
export function getWeekPeriod(weeksAgo: number = 0): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Start of current week (Monday)
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday - (weeksAgo * 7));
  monday.setHours(0, 0, 0, 0);

  // End of week (Sunday)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: formatLocalDate(monday),
    end: formatLocalDate(sunday),
  };
}

// Get yesterday's date period (for daily reports)
export function getYesterdayPeriod(): { start: string; end: string; dateLabel: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = formatLocalDate(yesterday);

  // Format date label in Norwegian (e.g., "4. feb 2026")
  const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const day = yesterday.getDate();
  const month = months[yesterday.getMonth()];
  const year = yesterday.getFullYear();
  const dateLabel = `${day}. ${month} ${year}`;

  return {
    start: dateStr,
    end: dateStr,
    dateLabel,
  };
}

// YTD period (Jan 1 to today)
export function getYTDPeriod(year: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(year, 0, 1); // Jan 1
  const end = new Date(year, now.getMonth(), now.getDate()); // Same day/month in target year

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

// Week-to-date period: Monday through the given date, with YoY via same ISO week last year
export function getWTDPeriod(yesterday: Date): {
  start: string; end: string;
  yoyStart: string; yoyEnd: string;
  label: string;
} {
  const dayOfWeek = yesterday.getDay(); // 0=Sun, 1=Mon, ...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(yesterday);
  monday.setDate(yesterday.getDate() - daysFromMonday);

  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const startDay = weekdayNames[0]; // Always Mon
  const endDay = weekdayNames[daysFromMonday];
  const label = daysFromMonday === 0 ? startDay : `${startDay}–${endDay}`;

  // YoY: same ISO week last year, same weekday range
  const weekNumber = getWeekNumber(yesterday);
  const yearForWeek = yesterday.getFullYear();
  const lastYearWeek = getSameWeekLastYear(weekNumber, yearForWeek);
  // lastYearWeek is Mon-Sun, we need Mon through same relative day
  const yoyMonday = new Date(lastYearWeek.start + 'T00:00:00');
  const yoyEnd = new Date(yoyMonday);
  yoyEnd.setDate(yoyMonday.getDate() + daysFromMonday);

  return {
    start: formatLocalDate(monday),
    end: formatLocalDate(yesterday),
    yoyStart: formatLocalDate(yoyMonday),
    yoyEnd: formatLocalDate(yoyEnd),
    label,
  };
}

// Month-to-date period: 1st of month through the given date, with YoY via same calendar dates
export function getMTDPeriod(endDate: Date): {
  start: string; end: string;
  yoyStart: string; yoyEnd: string;
  label: string;
} {
  const monthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[endDate.getMonth()];
  const label = `${monthName} ${monthStart.getDate()}–${endDate.getDate()}`;

  // YoY: same calendar dates last year
  const yoyStart = new Date(monthStart);
  yoyStart.setFullYear(yoyStart.getFullYear() - 1);
  const yoyEnd = new Date(endDate);
  yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

  return {
    start: formatLocalDate(monthStart),
    end: formatLocalDate(endDate),
    yoyStart: formatLocalDate(yoyStart),
    yoyEnd: formatLocalDate(yoyEnd),
    label,
  };
}

// Trailing 12 months
export function getT12MPeriod(endDate: Date): { start: string; end: string } {
  const end = new Date(endDate);
  const start = new Date(endDate);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1); // Start day after 1 year ago

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

