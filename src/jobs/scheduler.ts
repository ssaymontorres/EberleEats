import cron from 'node-cron';
import { scrapeCardapio } from '../services/scraper.service';
import { parseMenuText } from '../services/parser.service';
import { persistMenu, getTodayMenu } from '../services/menu.service';
import { sendTodayMenu } from '../services/whatsapp.service';

// Timezone: Brasília (UTC-3)
const TZ = 'America/Sao_Paulo';

/**
 * Job 1 — Todo domingo às 18h: baixa, processa e persiste o cardápio da semana
 */
export function startWeeklyScraperJob(): void {
    // '0 18 * * 0' = todo domingo às 18:00
    cron.schedule(
        '0 18 * * 0',
        async () => {
            console.log('\n🕕 [CRON] Iniciando scrape semanal do cardápio...');
            try {
                const scraperOutput = await scrapeCardapio();
                const parsed = parseMenuText(scraperOutput);
                await persistMenu(parsed);
                console.log('✅ [CRON] Cardápio da semana salvo com sucesso!');
            } catch (err) {
                console.error('❌ [CRON] Falha no scrape semanal:', err);
            }
        },
        { timezone: TZ },
    );

    console.log("📅 Job 'Scrape semanal' agendado: domingos às 18:00");
}

/**
 * Job 2 — Segunda a sexta às 07h30: envia o cardápio do dia no WhatsApp
 */
export function startDailyNotificationJob(): void {
    // '30 7 * * 1-5' = seg a sex às 07:30
    cron.schedule(
        '30 7 * * 1-5',
        async () => {
            console.log('\n🕖 [CRON] Enviando cardápio do dia...');
            try {
                const todayMenu = await getTodayMenu();
                if (!todayMenu) {
                    console.log('[CRON] Nenhum cardápio disponível para hoje.');
                    return;
                }
                await sendTodayMenu(todayMenu);
                console.log('✅ [CRON] Envio do dia concluído!');
            } catch (err) {
                console.error('❌ [CRON] Falha no envio diário:', err);
            }
        },
        { timezone: TZ },
    );

    console.log("📅 Job 'Envio diário' agendado: seg-sex às 07:30");
}

/**
 * Job 3 — Seg a sex às 11h30: lembrete de almoço (opcional)
 */
export function startLunchReminderJob(): void {
    // '30 11 * * 1-5' = seg a sex às 11:30
    cron.schedule(
        '30 11 * * 1-5',
        async () => {
            console.log('\n🍽️ [CRON] Enviando lembrete de almoço...');
            try {
                const todayMenu = await getTodayMenu();
                if (!todayMenu) return;
                await sendTodayMenu(todayMenu);
                console.log('✅ [CRON] Lembrete enviado!');
            } catch (err) {
                console.error('❌ [CRON] Falha no lembrete:', err);
            }
        },
        { timezone: TZ },
    );

    console.log("📅 Job 'Lembrete almoço' agendado: seg-sex às 11:30");
}

/**
 * Inicia todos os jobs agendados
 */
export function startAllJobs(): void {
    startWeeklyScraperJob();
    startDailyNotificationJob();
    startLunchReminderJob();
    console.log('\n🚀 Todos os jobs iniciados! EberleEats está de pé.\n');
}
