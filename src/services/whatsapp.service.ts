import axios from 'axios';
import { Prisma, Category } from '@prisma/client';
import { env, recipientList } from '../config/env';
import { EvolutionApiPayload, EvolutionApiResponse } from '../types/menu.types';

const DAY_LABELS: Record<string, string> = {
    MON: 'Segunda-feira',
    TUE: 'Terça-feira',
    WED: 'Quarta-feira',
    THU: 'Quinta-feira',
    FRI: 'Sexta-feira',
};

const CATEGORY_CONFIG: Record<
    Category,
    { icon: string; label: string; note?: string }
> = {
    CAFE_DA_MANHA: { icon: '☕', label: 'CAFÉ DA MANHÃ' },
    SABORES: { icon: '🟡', label: 'SABORES' },
    SELECT: { icon: '🔵', label: 'SELECT', note: '_Reserva pelo código 7_' },
    GOURMET: { icon: '🟣', label: 'GOURMET', note: '_Reserva pelo código 8_' },
};

type MenuDayWithItems = Prisma.MenuDayGetPayload<{ include: { items: true } }>;

/**
 * Formata a mensagem do WhatsApp para o dia atual
 */
export function formatDayMessage(day: MenuDayWithItems): string {
    const dayLabel = DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek;
    const dateFormatted = new Date(day.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    });

    const lines: string[] = [
        `🍽️ *Cardápio de Hoje — ${dayLabel} (${dateFormatted})*`,
        '',
    ];

    for (const item of day.items) {
        const config = CATEGORY_CONFIG[item.category];
        const header = config.note
            ? `${config.icon} *${config.label}* ${config.note}`
            : `${config.icon} *${config.label}*`;

        lines.push(header);
        item.dishes.forEach((dish: string) => lines.push(`• ${dish}`));

        if (item.reservationDate) {
            const resDate = new Date(item.reservationDate).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                timeZone: 'America/Sao_Paulo',
            });
            lines.push(`📅 _Reservar até: ${resDate}_`);
        }

        lines.push('');
    }

    lines.push('_Bom apetite! 🍴_');
    lines.push('_EberleEats 🤖_');

    return lines.join('\n');
}

/**
 * Envia uma mensagem de texto via Evolution API
 */
export async function sendMessage(phone: string, text: string): Promise<void> {
    const url = `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`;

    const payload: EvolutionApiPayload = { number: phone, text };

    try {
        const response = await axios.post<EvolutionApiResponse>(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                apikey: env.EVOLUTION_API_KEY,
            },
            timeout: 15_000,
        });

        console.log(`✅ Mensagem enviada para ${phone} — ID: ${response.data.key?.id}`);
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            console.error(
                `❌ Erro ao enviar para ${phone}: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
            );
        } else {
            throw err;
        }
    }
}

/**
 * Envia o cardápio do dia para todos os destinatários configurados
 */
export async function sendTodayMenu(day: MenuDayWithItems): Promise<void> {
    const message = formatDayMessage(day);

    console.log(`📤 Enviando cardápio para ${recipientList.length} destinatário(s)...`);
    console.log('─'.repeat(60));
    console.log(message);
    console.log('─'.repeat(60));

    const results = await Promise.allSettled(
        recipientList.map((phone) => sendMessage(phone, message)),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
        console.warn(`⚠️  ${failed.length} envio(s) falharam`);
    }
}

/**
 * Envia mensagem de lembrete (horário do almoço)
 */
export async function sendLunchReminder(): Promise<void> {
    const message = `🕐 *Lembrete!* O almoço está servido!\n\nNão esqueça de verificar o cardápio de hoje. Bom apetite! 🍴`;

    for (const phone of recipientList) {
        await sendMessage(phone, message);
    }
}
