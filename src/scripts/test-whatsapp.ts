import '../config/env';
import { getTodayMenu } from '../services/menu.service';
import { formatDayMessage, sendTodayMenu } from '../services/whatsapp.service';
import { prisma } from '../lib/prisma';

async function main() {
    console.log('🧪 Teste de formatação e envio WhatsApp\n');

    const today = await getTodayMenu();

    if (!today) {
        console.log('❌ Nenhum cardápio disponível para hoje no banco de dados.');
        console.log('💡 Execute primeiro: npx ts-node src/scripts/test-scraper.ts');
        await prisma.$disconnect();
        return;
    }

    // Mostra a mensagem formatada
    const message = formatDayMessage(today);
    console.log('📱 Mensagem que será enviada:\n');
    console.log('─'.repeat(60));
    console.log(message);
    console.log('─'.repeat(60));

    // Descomente para realmente enviar:
    // console.log('\n📤 Enviando...');
    // await sendTodayMenu(today);
    // console.log('✅ Enviado!');

    await prisma.$disconnect();
    console.log('\n✅ Teste de formatação concluído!');
    console.log('💡 Descomente a linha sendTodayMenu() para enviar de verdade.');
}

main().catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
