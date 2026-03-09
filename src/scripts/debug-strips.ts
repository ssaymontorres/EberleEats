import * as dotenv from 'dotenv';
dotenv.config();
process.env.CARDAPIO_URL = process.env.CARDAPIO_URL ||
    'http://intranet.mundial.com.br/wordpress/customizacoes/Documentos/cardapio/cardapio_cxs.pdf';

import { scrapeCardapio } from '../services/scraper.service';

async function main() {
    const out = await scrapeCardapio();
    console.log('\n=== HEADER TEXT ===');
    console.log(JSON.stringify(out.headerText));
    console.log('\n=== DAY TEXTS ===');
    out.dayTexts.forEach((t, i) => {
        console.log(`\n--- DAY ${i + 1} ---`);
        console.log(JSON.stringify(t));
    });
    console.log('\n=== SELECT LINES ===');
    console.log(JSON.stringify(out.selectLines));
    console.log('\n=== GOURMET LINES ===');
    console.log(JSON.stringify(out.gourmetLines));
}
main().catch(e => { console.error(e); process.exit(1); });
