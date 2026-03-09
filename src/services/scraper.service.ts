import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as canvas from 'canvas';
import { env } from '../config/env';

// pdf-parse — CJS require do entry point padrão
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const pdfParse: any = require('pdf-parse');

// pdfjs-dist v3 — legacy CJS build estável para Node.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist');

const TMP_DIR = path.join(process.cwd(), 'tmp');
const PDF_PATH = path.join(TMP_DIR, 'cardapio.pdf');

// Desabilita worker
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = '';

// NodeCanvasFactory para pdfjs em Node.js
const NodeCanvasFactory = {
    create(width: number, height: number) {
        const c = canvas.createCanvas(width, height);
        return { canvas: c, context: c.getContext('2d') };
    },
    reset(cc: { canvas: canvas.Canvas }, w: number, h: number) { cc.canvas.width = w; cc.canvas.height = h; },
    destroy(cc: { canvas: canvas.Canvas }) { cc.canvas.width = 0; cc.canvas.height = 0; },
};

function ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

export async function downloadCardapio(): Promise<Buffer> {
    console.log(`⬇️  Baixando cardápio de: ${env.CARDAPIO_URL}`);
    ensureTmpDir();

    const response = await axios.get<ArrayBuffer>(env.CARDAPIO_URL, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120' },
    });

    const buffer = Buffer.from(response.data);
    fs.writeFileSync(PDF_PATH, buffer);
    console.log(`✅ PDF salvo (${(buffer.length / 1024).toFixed(1)} KB)`);
    return buffer;
}

/**
 * Renderiza o PDF inteiro como imagem e retorna o canvas
 */
async function renderPdfToCanvas(buffer: Buffer, scale = 2.5): Promise<canvas.Canvas> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfDoc: any = await (pdfjsLib as any).getDocument({
        data: new Uint8Array(buffer),
        canvasFactory: NodeCanvasFactory,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        verbosity: 0,
    }).promise;

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale });
    const { canvas: canvasEl, context: ctx } = NodeCanvasFactory.create(
        Math.floor(viewport.width),
        Math.floor(viewport.height),
    );

    // @ts-ignore — node-canvas ctx é compatível em runtime
    await page.render({ canvasContext: ctx, viewport, canvasFactory: NodeCanvasFactory }).promise;
    return canvasEl;
}

/**
 * Recorta uma faixa vertical do canvas e salva como PNG
 * Retorna o path do arquivo temporário
 */
function cropStrip(
    src: canvas.Canvas,
    x: number,
    y: number,
    w: number,
    h: number,
    name: string,
): string {
    const strip = canvas.createCanvas(w, h);
    const ctx = strip.getContext('2d');
    ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
    const filePath = path.join(TMP_DIR, `${name}.png`);
    fs.writeFileSync(filePath, strip.toBuffer('image/png'));
    return filePath;
}

/**
 * Roda Tesseract.js numa imagem e retorna o texto
 */
async function ocr(imagePath: string): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('por');
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    return text.trim();
}

/**
 * Estratégia principal:
 * 1. Renderiza o PDF inteiro como PNG em alta resolução
 * 2. Divide a imagem em faixas:
 *    - 1 faixa de cabeçalho (semana, header)
 *    - 5 faixas verticais (una por dia) para a área da tabela principal
 *    - 1 faixa de rodapé (SELECT + GOURMET — essas linhas são horizontais também)
 * 3. OCR em cada faixa separadamente → texto limpo por coluna
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{
    fullText: string;
    headerText: string;
    dayTexts: string[];     // [MON, TUE, WED, THU, FRI]
    selectLines: string[];
    gourmetLines: string[];
}> {
    console.log('🖼️  Renderizando PDF como imagem...');
    const fullCanvas = await renderPdfToCanvas(buffer, 2.5);
    const W = fullCanvas.width;
    const H = fullCanvas.height;

    // Salva imagem completa para debugs futuros
    fs.writeFileSync(path.join(TMP_DIR, 'cardapio_full.png'), fullCanvas.toBuffer('image/png'));

    // ── Proporções aproximadas do layout do PDF ──────────────────────────────
    // Cabeçalho (logo + título + semana + OBS): ~18% do height
    // Tabela (SABORES, colunas de dias): do Y=18% ao Y=75% 
    // Lateral esquerda (labels Sabores/Select/Gourmet): ~12% do width
    // 5 colunas de dias: de X=12% ao X=100%, divididas igualmente
    // Rodapé de reservas (SELECT + GOURMET): Y=75% ao Y=100%
    // ─────────────────────────────────────────────────────────────────────────

    const headerH = Math.floor(H * 0.18);
    const tableStartY = headerH;
    const tableEndY = Math.floor(H * 0.72);
    const footerStartY = tableEndY;

    const labelW = Math.floor(W * 0.12);  // coluna dos labels do lado esquerdo
    const tableStartX = labelW;
    const tableW = W - labelW;
    const colW = Math.floor(tableW / 5);

    console.log('✂️  Recortando faixas por dia...');

    // Header (semana)
    const headerPath = cropStrip(fullCanvas, 0, 0, W, headerH, 'header');
    const headerText = await ocr(headerPath);
    try { fs.unlinkSync(headerPath); } catch { /* ok */ }

    // 5 colunas (uma por dia)
    const dayTexts: string[] = [];
    for (let i = 0; i < 5; i++) {
        const x = tableStartX + i * colW;
        const colH = tableEndY - tableStartY;
        const colPath = cropStrip(fullCanvas, x, tableStartY, colW, colH, `day_${i}`);
        const text = await ocr(colPath);
        dayTexts.push(text);
        try { fs.unlinkSync(colPath); } catch { /* ok */ }
        console.log(`  ✅ Dia ${i + 1}/5 OCR concluído`);
    }

    // Rodapé (SELECT e GOURMET — linha horizontal com todos os dias)
    const footerH = H - footerStartY;
    const footerPath = cropStrip(fullCanvas, 0, footerStartY, W, footerH, 'footer');
    const footerText = await ocr(footerPath);
    try { fs.unlinkSync(footerPath); } catch { /* ok */ }

    // Separa SELECT e GOURMET no footer pelo CÓDIGO DA RESERVA
    const footerLines = footerText.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const selectLines: string[] = [];
    const gourmetLines: string[] = [];
    let footerPhase: 'pre' | 'select' | 'gourmet' = 'pre';
    for (const line of footerLines) {
        if (/C[ÓO]DIGO\s+DA\s+RESERVA\s*:?\s*7/i.test(line)) { footerPhase = 'select'; continue; }
        if (/C[ÓO]DIGO\s+DA\s+RESERVA\s*:?\s*8/i.test(line)) { footerPhase = 'gourmet'; continue; }
        if (footerPhase === 'select') selectLines.push(line);
        if (footerPhase === 'gourmet') gourmetLines.push(line);
    }

    const fullText = [headerText, ...dayTexts, footerText].join('\n');

    console.log(`✅ OCR completo — ${dayTexts.length} colunas + footer`);
    return { fullText, headerText, dayTexts, selectLines, gourmetLines };
}

export async function scrapeCardapio() {
    const buffer = await downloadCardapio();
    return await extractTextFromPdf(buffer);
}
