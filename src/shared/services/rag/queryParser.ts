/**
 * QueryParser - 자연어 쿼리를 구조화된 검색 조건으로 변환
 * 
 * @role 사용자의 자연어 질문에서 날짜, 완료 상태, 키워드 등을 추출
 */

export interface ParsedQuery {
    // 날짜 관련
    dateFilter?: string;           // YYYY-MM-DD 형식
    dateRange?: {                  // 날짜 범위
        start: string;
        end: string;
    };
    relativeDateType?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month';

    // 상태 필터
    completedFilter?: boolean;     // true: 완료, false: 미완료, undefined: 전체

    // 시간대 필터
    timeBlockFilter?: string;      // 'morning', 'afternoon', etc.

    // 검색어
    keywords: string[];            // 핵심 키워드
    originalQuery: string;         // 원본 쿼리

    // 쿼리 유형
    queryType: 'date_specific' | 'status_query' | 'semantic_search' | 'stats_query';
}

/**
 * 자연어 쿼리를 파싱하여 구조화된 검색 조건으로 변환
 */
export function parseQuery(query: string): ParsedQuery {
    const result: ParsedQuery = {
        keywords: [],
        originalQuery: query,
        queryType: 'semantic_search', // 기본값
    };

    const now = new Date();
    const today = formatDate(now);

    // 1. 날짜 파싱 (다양한 패턴 지원)

    // "MM월 DD일" 패턴
    const dateMatch = query.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (dateMatch) {
        const month = dateMatch[1].padStart(2, '0');
        const day = dateMatch[2].padStart(2, '0');
        const year = now.getFullYear();
        result.dateFilter = `${year}-${month}-${day}`;
        result.queryType = 'date_specific';
    }

    // "YYYY-MM-DD" 패턴
    const isoDateMatch = query.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
        result.dateFilter = isoDateMatch[0];
        result.queryType = 'date_specific';
    }

    // 상대적 날짜 표현
    if (/오늘|today/i.test(query)) {
        result.dateFilter = today;
        result.relativeDateType = 'today';
        result.queryType = 'date_specific';
    } else if (/어제|yesterday/i.test(query)) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        result.dateFilter = formatDate(yesterday);
        result.relativeDateType = 'yesterday';
        result.queryType = 'date_specific';
    } else if (/그저께|그제|엊그제/.test(query)) {
        const dayBeforeYesterday = new Date(now);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
        result.dateFilter = formatDate(dayBeforeYesterday);
        result.queryType = 'date_specific';
    } else if (/이번\s*주|금주|this\s*week/i.test(query)) {
        result.dateRange = getWeekRange(now, 0);
        result.relativeDateType = 'this_week';
        result.queryType = 'date_specific';
    } else if (/지난\s*주|저번\s*주|last\s*week/i.test(query)) {
        result.dateRange = getWeekRange(now, -1);
        result.relativeDateType = 'last_week';
        result.queryType = 'date_specific';
    } else if (/이번\s*달|금월|this\s*month/i.test(query)) {
        result.dateRange = getMonthRange(now, 0);
        result.relativeDateType = 'this_month';
        result.queryType = 'date_specific';
    } else if (/최근\s*(\d+)\s*일/.test(query)) {
        const daysMatch = query.match(/최근\s*(\d+)\s*일/);
        if (daysMatch) {
            const days = parseInt(daysMatch[1], 10);
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - days + 1);
            result.dateRange = {
                start: formatDate(startDate),
                end: today,
            };
            result.queryType = 'date_specific';
        }
    }

    // 2. 완료 상태 파싱
    if (/완료|끝낸|마친|했던|수행한|처리한|달성|성공/.test(query)) {
        result.completedFilter = true;
        if (result.queryType === 'semantic_search') {
            result.queryType = 'status_query';
        }
    } else if (/미완료|안\s*한|못\s*한|남은|pending|실패|못\s*했/.test(query)) {
        result.completedFilter = false;
        if (result.queryType === 'semantic_search') {
            result.queryType = 'status_query';
        }
    }

    // 3. 통계 관련 쿼리 감지
    if (/몇\s*개|얼마나|통계|분석|요약|총|합계|평균/.test(query)) {
        result.queryType = 'stats_query';
    }

    // 4. 시간대 필터
    if (/아침|새벽|morning|dawn/.test(query)) {
        result.timeBlockFilter = 'dawn';
    } else if (/오전|morning/.test(query)) {
        result.timeBlockFilter = 'morning';
    } else if (/점심|낮|noon|midday/.test(query)) {
        result.timeBlockFilter = 'midday';
    } else if (/오후|afternoon/.test(query)) {
        result.timeBlockFilter = 'afternoon';
    } else if (/저녁|evening/.test(query)) {
        result.timeBlockFilter = 'evening';
    } else if (/밤|야간|night/.test(query)) {
        result.timeBlockFilter = 'night';
    }

    // 5. 키워드 추출 (불용어 제거)
    const stopWords = new Set([
        '에', '은', '는', '이', '가', '을', '를', '의', '와', '과', '도', '로', '으로',
        '에서', '까지', '부터', '한', '하는', '된', '되는', '할', '했', '해', '하고',
        '있', '없', '그', '저', '이런', '저런', '뭐', '어떤', '무슨',
        '좀', '약간', '조금', '많이', '전부', '모든', '다',
        '알려', '줘', '주세요', '보여', '말해', '찾아',
        '완료', '미완료', '작업', '할일', '일', '것',
        '오늘', '어제', '내일', '이번', '지난', '다음',
        '월', '일', '주', '년',
    ]);

    const words = query
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.has(word));

    result.keywords = words;

    return result;
}

// 헬퍼 함수들
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekRange(baseDate: Date, weekOffset: number): { start: string; end: string } {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + weekOffset * 7);
    
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
        start: formatDate(monday),
        end: formatDate(sunday),
    };
}

function getMonthRange(baseDate: Date, monthOffset: number): { start: string; end: string } {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + monthOffset);
    
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
    };
}
