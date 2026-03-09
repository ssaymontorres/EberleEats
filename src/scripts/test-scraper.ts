/**
 * Teste completo: Scrape + Parse (sem banco de dados, sem WhatsApp)
 * Roda contra a URL real da intranet e exibe o cardápio estruturado por dia
 */
import * as dotenv from 'dotenv';
dotenv.config();

process.env.CARDAPIO_URL =
    process.env.CARDAPIO_URL ||
    'http://intranet.mundial.com.br/wordpress/customizacoes/Documentos/cardapio/cardapio_cxs.pdf';

import { scrapeCardapio } from '../services/scraper.service';
import { parseMenuText } from '../services/parser.service';
import { formatDayMessage } from '../services/whatsapp.service';

const dayNames = { MON: 'Segunda', TUE: 'Terça', WED: 'Quarta', THU: 'Quinta', FRI: 'Sexta' };

async function main() {
    console.log('🧪 Teste: Scrape + Parse\n');

    const scraperOutput = await scrapeCardapio();
    const parsed = parseMenuText(scraperOutput);

    console.log(`\n📅 Semana: ${parsed.weekStart.toLocaleDateString('pt-BR')} a ${parsed.weekEnd.toLocaleDateString('pt-BR')}`);
    console.log(`📆 Dias parseados: ${parsed.days.length}/5\n`);

    for (const day of parsed.days) {
        const label = dayNames[day.dayOfWeek as keyof typeof dayNames] ?? day.dayOfWeek;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  ✦ ${label} (${day.date.toLocaleDateString('pt-BR')})`);
        console.log('='.repeat(60));

        if (day.items.length === 0) {
            console.log('  (sem pratos encontrados)');
            continue;
        }

        for (const item of day.items) {
            console.log(`\n  [${item.category}]`);
            item.dishes.forEach(d => console.log(`    • ${d}`));
            if (item.reservationCode) console.log(`    📋 Código de reserva: ${item.reservationCode}`);
            if (item.reservationDate) console.log(`    📅 Reservar até: ${item.reservationDate.toLocaleDateString('pt-BR')}`);
        }
    }

    // Simula a mensagem que seria enviada hoje
    const today = new Date();
    const dayOfWeekMap: Record<number, string> = { 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI' };
    const todayDow = dayOfWeekMap[today.getDay()];
    const todayDay = parsed.days.find(d => d.dayOfWeek === todayDow);

    if (todayDay) {
        console.log('\n\n' + '─'.repeat(60));
        console.log('📱 PRÉVIA DA MENSAGEM DE HOJE (WhatsApp):');
        console.log('─'.repeat(60));
        const lines: string[] = [
            `🍽️ *Cardápio de Hoje — ${dayNames[todayDay.dayOfWeek as keyof typeof dayNames]} (${todayDay.date.toLocaleDateString('pt-BR')})*`,
            '',
        ];
        const icons: Record<string, string> = { SABORES: '🟡', SELECT: '🔵', GOURMET: '🟣' };
        for (const item of todayDay.items) {
            lines.push(`${icons[item.category] ?? '•'} *${item.category}*`);
            item.dishes.forEach(d => lines.push(`• ${d}`));
            if (item.reservationDate) lines.push(`📅 _Reservar até: ${item.reservationDate.toLocaleDateString('pt-BR')}_`);
            lines.push('');
        }
        lines.push('_Bom apetite! 🍴_\n_EberleEats 🤖_');
        console.log(lines.join('\n'));
    }

    console.log('\n✅ Teste concluído!');
}

main().catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
