import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),
    EVOLUTION_API_URL: z.string().url('EVOLUTION_API_URL deve ser uma URL válida'),
    EVOLUTION_API_KEY: z.string().min(1, 'EVOLUTION_API_KEY é obrigatória'),
    EVOLUTION_INSTANCE: z.string().min(1, 'EVOLUTION_INSTANCE é obrigatória'),
    WHATSAPP_RECIPIENTS: z.string().min(1, 'WHATSAPP_RECIPIENTS é obrigatório'),
    CARDAPIO_URL: z
        .string()
        .url()
        .default(
            'http://intranet.mundial.com.br/wordpress/customizacoes/Documentos/cardapio/cardapio_cxs.pdf',
        ),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Variáveis de ambiente inválidas:');
    for (const issue of parsed.error.issues) {
        console.error(`  ${String(issue.path.join('.'))}: ${issue.message}`);
    }
    process.exit(1);
}

export const env = parsed.data;

export const recipientList = env.WHATSAPP_RECIPIENTS.split(',').map((n) => n.trim());
