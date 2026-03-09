import { Category, DayOfWeek } from '@prisma/client';
import { ParsedMenu, ParsedMenuDay, ParsedMenuItem } from '../types/menu.types';

/**
 * Nova estratégia de parsing:
 * O scraper agora retorna texto separado por COLUNA (uma por dia)
 * então cada dayText contém apenas os pratos de UM dia.
 *
 * Para SELECT e GOURMET: o scraper extrai as linhas do rodapé horizontalmente.
 * Cada linha pode ter dados de todos os dias misturados — mas filtramos por posição.
 */

const DAY_ORDER: DayOfWeek[] = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI];

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractWeekRange(text: string): { weekStart: Date; weekEnd: Date } | null {
    // Busca padrão DD/MM/YYYY a DD/MM/YYYY ou DD/MM a DD/MM/YYYY
    const m = text.match(/(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+(?:a|├á)\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    if (!m) {
        // Fallback para quando o OCR falha muito (busca apenas dois padrões de data separados por 'a')
        const dates = text.match(/(\d{2})\/(\d{2})/g);
        if (dates && dates.length >= 2) {
            const now = new Date();
            const year = now.getFullYear();
            const [d1, m1] = dates[0].split('/');
            const [d2, m2] = dates[1].split('/');
            return {
                weekStart: new Date(`${year}-${m1}-${d1}T12:00:00Z`),
                weekEnd: new Date(`${year}-${m2}-${d2}T12:00:00Z`),
            };
        }
        return null;
    }
    const year = m[6];
    const startYear = m[3] ?? year;
    const startYearFixed = startYear.length === 2 ? `20${startYear}` : startYear;
    return {
        weekStart: new Date(`${startYearFixed}-${m[2]}-${m[1]}T12:00:00Z`),
        weekEnd: new Date(`${year}-${m[5]}-${m[4]}T12:00:00Z`),
    };
}

/** Remove artefatos de OCR */
function cleanLine(line: string): string {
    return line
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isNoise(line: string): boolean {
    if (line.length < 2) return true;
    // Linha dominada por caracteres não-ASCII = artefato OCR
    const nonAscii = (line.match(/[^\x20-\x7EàáâãäèéêëìíîïòóôõùúûüçÇÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚ]/g) ?? []).length;
    if (nonAscii > line.length * 0.35) return true;
    // Textos-label que não são pratos
    if (/^(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|CARD[ÁA]PIO|SEMANA|OBS:|ALIMENT)/i.test(line)) return true;
    return false;
}

function isReserveMarker(line: string): boolean {
    return /C[ÓO]DIGO\s+DA\s+RESERVA/i.test(line);
}

function extractReserveDate(text: string, year: number): Date | undefined {
    const m = text.match(/RESERVAR\s+(?:DIA\s+)?(\d{2})[./](\d{2})/i);
    if (!m) return undefined;
    return new Date(`${year}-${m[2]}-${m[1]}T12:00:00Z`);
}

/** Extrai texto limpo de um bloco de OCR de uma coluna de dia */
function extractDayDishes(colText: string): string[] {
    const lines = colText.split('\n').map(cleanLine).filter(l => !isNoise(l));
    const dishes: string[] = [];
    for (const line of lines) {
        // Ignora linhas de reserva dentro do SABORES
        if (isReserveMarker(line)) break; // chegou na área de reservas
        if (/RESERVAR/i.test(line)) continue;
        if (/^(Sabores?|Select|Gourmet)\b/i.test(line)) continue; // ignora label lateral
        const cleaned = line
            .replace(/\(RESERVAR[^)]*\)/gi, '')
            .replace(/^[><*]+/, '')
            .trim();
        if (cleaned.length > 2) dishes.push(cleaned);
    }
    return dishes;
}

// ─── Exportadores de SELECT/GOURMET do rodapé ──────────────────────────────

interface CategoryBlock {
    dishes: string[];
    reservationCode?: number;
    reservationDate?: Date;
}

/**
 * Do texto da coluna de cada dia (que inclui o rodapé),
 * extrai o prato SELECT e GOURMET desta coluna específica.
 */
function extractReservationFromCol(colText: string, year: number): {
    select?: CategoryBlock;
    gourmet?: CategoryBlock;
} {
    const lines = colText.split('\n').map(cleanLine).filter(l => l.length > 1);
    let phase: 'pre' | 'select' | 'gourmet' = 'pre';
    let selectCode = 7, gourmetCode = 8;
    const selectDishes: string[] = [];
    const gourmetDishes: string[] = [];
    let selectDate: Date | undefined;
    let gourmetDate: Date | undefined;

    for (const line of lines) {
        if (/C[ÓO]DIGO\s+DA\s+RESERVA\s*:?\s*7/i.test(line)) { phase = 'select'; continue; }
        if (/C[ÓO]DIGO\s+DA\s+RESERVA\s*:?\s*8/i.test(line)) { phase = 'gourmet'; continue; }

        if (phase === 'select') {
            const d = extractReserveDate(line, year);
            if (d) { selectDate = d; continue; }
            const cleaned = line.replace(/\(RESERVAR[^)]*\)/gi, '').replace(/^[><*Ss\s]+/, '').trim();
            if (cleaned.length > 2 && !/^(Select|EA|ppp)/i.test(cleaned)) {
                selectDishes.push(cleaned);
            }
        }
        if (phase === 'gourmet') {
            const d = extractReserveDate(line, year);
            if (d) { gourmetDate = d; continue; }
            const cleaned = line.replace(/\(RESERVAR[^)]*\)/gi, '').replace(/^[><*Gg\s]+/, '').trim();
            if (cleaned.length > 2 && !/^(Gourmet|h[oó]stia)/i.test(cleaned)) {
                gourmetDishes.push(cleaned);
            }
        }
    }

    return {
        select: selectDishes.length > 0 ? { dishes: selectDishes, reservationCode: selectCode, reservationDate: selectDate } : undefined,
        gourmet: gourmetDishes.length > 0 ? { dishes: gourmetDishes, reservationCode: gourmetCode, reservationDate: gourmetDate } : undefined,
    };
}

// ─── Parser principal ───────────────────────────────────────────────────────

/**
 * Recebe a saída estruturada do scraper (extraída por colunas) e monta o ParsedMenu
 */
export function parseMenuText(scraperOutput: {
    fullText: string;
    headerText: string;
    dayTexts: string[];
    selectLines: string[];
    gourmetLines: string[];
}): ParsedMenu {
    const { fullText, headerText, dayTexts } = scraperOutput;

    // 1. Semana — busca em todas as fontes disponíveis
    const allTextSources = [fullText, headerText, ...dayTexts].join('\n');
    const weekRange = extractWeekRange(allTextSources);
    if (!weekRange) {
        throw new Error('Não foi possível encontrar o intervalo da semana no texto OCR.');
    }
    const year = weekRange.weekStart.getFullYear();

    // 2. Montar dias
    const days: ParsedMenuDay[] = DAY_ORDER.map((dow, idx) => {
        const date = new Date(weekRange.weekStart);
        date.setDate(date.getDate() + idx);

        const colText = dayTexts[idx] ?? '';
        const items: ParsedMenuItem[] = [];

        // SABORES
        const saboreDishes = extractDayDishes(colText);
        if (saboreDishes.length > 0) {
            items.push({ category: Category.SABORES, dishes: saboreDishes });
        }

        // SELECT e GOURMET da coluna do dia
        const { select, gourmet } = extractReservationFromCol(colText, year);
        if (select) {
            items.push({
                category: Category.SELECT,
                dishes: select.dishes,
                reservationCode: select.reservationCode,
                reservationDate: select.reservationDate,
            });
        }
        if (gourmet) {
            items.push({
                category: Category.GOURMET,
                dishes: gourmet.dishes,
                reservationCode: gourmet.reservationCode,
                reservationDate: gourmet.reservationDate,
            });
        }

        return { dayOfWeek: dow, date, items };
    });

    return { weekStart: weekRange.weekStart, weekEnd: weekRange.weekEnd, rawText: fullText, days };
}
