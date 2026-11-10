/**
 * Restaurant Business Day & Timezone Utilities
 * 
 * In restaurant operations, a "business day" typically runs from opening until closing
 * past midnight (e.g. 01:00 AM, 02:00 AM, 03:00 AM).
 * 
 * Standard Cut-Off Hour: 04:00 AM (4:00 IST).
 * - Orders created between 04:00 AM on Day X and 03:59:59 AM on Day X+1 belong to Business Day X.
 * - For example, 10/11/2026 at 01:08 AM belongs to 09/11/2026 business shift.
 * - Order numbering resets to 001 at 04:00 AM every morning.
 */

export const BUSINESS_DAY_CUTOFF_HOUR = 4; // 04:00 AM IST

/**
 * Returns a Date object representing the time in Indian Standard Time (Asia/Kolkata).
 * Works reliably in both browser and server (Node.js/Docker container regardless of host TZ).
 */
export function getISTDate(dateInput: Date | string | number = new Date()): Date {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return new Date();
    
    const istString = d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    return new Date(istString);
}

/**
 * Returns the Business Date (at 00:00:00) for a given timestamp.
 * If time is before 04:00 AM, it counts as the previous calendar day.
 */
export function getBusinessDate(dateInput: Date | string | number = new Date(), cutoffHour = BUSINESS_DAY_CUTOFF_HOUR): Date {
    const istDate = getISTDate(dateInput);
    const shifted = new Date(istDate.getTime() - cutoffHour * 60 * 60 * 1000);
    return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

/**
 * Returns business date formatted as 'YYYY-MM-DD'
 */
export function getBusinessDateString(dateInput: Date | string | number = new Date(), cutoffHour = BUSINESS_DAY_CUTOFF_HOUR): string {
    const bDate = getBusinessDate(dateInput, cutoffHour);
    const yyyy = bDate.getFullYear();
    const mm = String(bDate.getMonth() + 1).padStart(2, '0');
    const dd = String(bDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns order number prefix: 'YYYYMMDD'
 */
export function getBusinessOrderPrefix(dateInput: Date | string | number = new Date(), cutoffHour = BUSINESS_DAY_CUTOFF_HOUR): string {
    return getBusinessDateString(dateInput, cutoffHour).replace(/-/g, '');
}

/**
 * Checks if a date falls in TODAY's active business day shift.
 */
export function isTodayBusinessDay(dateInput: Date | string | number, cutoffHour = BUSINESS_DAY_CUTOFF_HOUR): boolean {
    const currentBusinessDateStr = getBusinessDateString(new Date(), cutoffHour);
    const targetBusinessDateStr = getBusinessDateString(dateInput, cutoffHour);
    return currentBusinessDateStr === targetBusinessDateStr;
}

/**
 * Checks if a date falls in YESTERDAY's business day shift.
 */
export function isYesterdayBusinessDay(dateInput: Date | string | number, cutoffHour = BUSINESS_DAY_CUTOFF_HOUR): boolean {
    const now = new Date();
    const istNow = getISTDate(now);
    const todayBusiness = getBusinessDate(istNow, cutoffHour);
    const yesterdayBusiness = new Date(todayBusiness.getTime() - 24 * 60 * 60 * 1000);
    
    const yyyy = yesterdayBusiness.getFullYear();
    const mm = String(yesterdayBusiness.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterdayBusiness.getDate()).padStart(2, '0');
    const yesterdayStr = `${yyyy}-${mm}-${dd}`;
    
    const targetBusinessDateStr = getBusinessDateString(dateInput, cutoffHour);
    return yesterdayStr === targetBusinessDateStr;
}

/**
 * Returns exact start and end Date objects for filtering reports and sales.
 */
export function getBusinessDateRange(
    filter: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all' | string,
    customStart?: string,
    customEnd?: string,
    cutoffHour = BUSINESS_DAY_CUTOFF_HOUR,
    nowInput: Date | string | number = new Date()
): { start: Date; end: Date } {
    const istNow = getISTDate(nowInput);
    const todayBusiness = getBusinessDate(istNow, cutoffHour);
    
    // Start of current business day (e.g. today at 04:00 AM)
    const currentBusinessStart = new Date(
        todayBusiness.getFullYear(),
        todayBusiness.getMonth(),
        todayBusiness.getDate(),
        cutoffHour,
        0,
        0,
        0
    );
    // End of current business day (24 hours later - 1ms)
    const currentBusinessEnd = new Date(currentBusinessStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    switch (filter) {
        case 'today':
            return { start: currentBusinessStart, end: currentBusinessEnd };
            
        case 'yesterday': {
            const yesterdayStart = new Date(currentBusinessStart.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayEnd = new Date(currentBusinessStart.getTime() - 1);
            return { start: yesterdayStart, end: yesterdayEnd };
        }
        
        case 'week': {
            // Last 7 business days
            const weekStart = new Date(currentBusinessStart.getTime() - 6 * 24 * 60 * 60 * 1000);
            return { start: weekStart, end: currentBusinessEnd };
        }
        
        case 'month': {
            // Last 30 business days
            const monthStart = new Date(currentBusinessStart.getTime() - 29 * 24 * 60 * 60 * 1000);
            return { start: monthStart, end: currentBusinessEnd };
        }
        
        case 'custom': {
            let start = new Date(0);
            let end = currentBusinessEnd;
            if (customStart) {
                const sDate = new Date(customStart);
                start = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), cutoffHour, 0, 0, 0);
            }
            if (customEnd) {
                const eDate = new Date(customEnd);
                // End of that business day (cutoffHour next morning - 1ms)
                end = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate() + 1, cutoffHour, 0, 0, 0);
                end = new Date(end.getTime() - 1);
            }
            return { start, end };
        }
        
        default:
            return { start: new Date(0), end: new Date(8640000000000000) };
    }
}
