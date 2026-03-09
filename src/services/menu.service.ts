import { DayOfWeek, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ParsedMenu } from '../types/menu.types';

/**
 * Persiste o cardápio semanal no banco de dados.
 * Se já existir um menu para essa semana, remove e recria.
 */
export async function persistMenu(parsed: ParsedMenu): Promise<void> {
    console.log(
        `💾 Persistindo cardápio da semana ${formatDate(parsed.weekStart)} a ${formatDate(parsed.weekEnd)}...`,
    );

    // Remove menu existente para a mesma semana (upsert por weekStart)
    await prisma.menu.deleteMany({
        where: {
            weekStart: parsed.weekStart,
        },
    });

    await prisma.menu.create({
        data: {
            weekStart: parsed.weekStart,
            weekEnd: parsed.weekEnd,
            rawText: parsed.rawText,
            days: {
                create: parsed.days.map((day) => ({
                    dayOfWeek: day.dayOfWeek,
                    date: day.date,
                    items: {
                        create: day.items.map((item) => ({
                            category: item.category,
                            dishes: item.dishes,
                            reservationCode: item.reservationCode ?? null,
                            reservationDate: item.reservationDate ?? null,
                        })),
                    },
                })),
            },
        },
    });

    console.log('✅ Cardápio persistido com sucesso!');
}

/**
 * Retorna o menu do dia atual (hoje)
 */
export async function getTodayMenu(): Promise<Prisma.MenuDayGetPayload<{ include: { items: { orderBy: { category: 'asc' } } } }> | null> {
    const today = new Date();
    const dayOfWeek = getTodayDayOfWeek(today);

    if (!dayOfWeek) {
        console.log('📅 Hoje é fim de semana — sem cardápio.');
        return null;
    }

    const menuDay = await prisma.menuDay.findFirst({
        where: {
            dayOfWeek,
            date: {
                gte: startOfDay(today),
                lt: endOfDay(today),
            },
        },
        include: {
            items: {
                orderBy: { category: 'asc' },
            },
        },
    });

    if (!menuDay) {
        console.warn(`⚠️  Nenhum cardápio encontrado para hoje (${dayOfWeek})`);
    }

    return menuDay;
}

/**
 * Retorna o DayOfWeek de hoje (null se for sábado/domingo)
 */
function getTodayDayOfWeek(date: Date): DayOfWeek | null {
    const jsDay = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const map: Record<number, DayOfWeek> = {
        1: DayOfWeek.MON,
        2: DayOfWeek.TUE,
        3: DayOfWeek.WED,
        4: DayOfWeek.THU,
        5: DayOfWeek.FRI,
    };
    return map[jsDay] ?? null;
}

function startOfDay(d: Date): Date {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
}

function endOfDay(d: Date): Date {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
}

function formatDate(d: Date): string {
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
