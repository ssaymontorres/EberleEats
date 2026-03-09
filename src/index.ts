import './config/env'; // Carrega e valida as variáveis antes de tudo
import { startAllJobs } from './jobs/scheduler';
import { prisma } from './lib/prisma';

async function bootstrap(): Promise<void> {
    console.log('');
    console.log('╔════════════════════════════════╗');
    console.log('║       🍽️  EberleEats Bot        ║');
    console.log('║  Cardápio automático no Zap!   ║');
    console.log('╚════════════════════════════════╝');
    console.log('');

    // Testa conexão com o banco
    try {
        await prisma.$connect();
        console.log('✅ Banco de dados conectado!\n');
    } catch (err) {
        console.error('❌ Erro ao conectar no banco de dados:', err);
        process.exit(1);
    }

    // Inicia os jobs agendados
    startAllJobs();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Encerrando EberleEats...');
        await prisma.$disconnect();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('\n🛑 Encerrando EberleEats...');
        await prisma.$disconnect();
        process.exit(0);
    });
}

bootstrap().catch((err) => {
    console.error('❌ Erro fatal no bootstrap:', err);
    process.exit(1);
});
