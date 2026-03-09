/**
 * Script de diagnóstico: mostra o texto bruto completo do OCR
 * para calibrar o parser com o layout real
 */
import * as dotenv from 'dotenv';
dotenv.config();

process.env.CARDAPIO_URL =
    process.env.CARDAPIO_URL ||
    'http://intranet.mundial.com.br/wordpress/customizacoes/Documentos/cardapio/cardapio_cxs.pdf';

import { downloadCardapio, extractTextFromPdf } from '../services/scraper.service';

async function main() {
    console.log('🔬 Diagnóstico: texto bruto do OCR\n');
    const buffer = await downloadCardapio();
    const output = await extractTextFromPdf(buffer);
    const rawText = output.fullText;

    console.log('\n───────── TEXTO COMPLETO ─────────');
    // Mostra cada linha numerada para entender a estrutura
    rawText.split('\n').forEach((line, i) => {
        console.log(`${String(i + 1).padStart(3, ' ')}: ${JSON.stringify(line)}`);
    });
    console.log('──────────────────────────────────\n');
    console.log(`Total de linhas: ${rawText.split('\n').length}`);
    console.log(`Total de chars: ${rawText.length}`);
}

main().catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
