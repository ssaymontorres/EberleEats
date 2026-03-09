import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'eberle_secret';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || 'EberleEats';

async function generateQR() {
    console.log(`📡 Buscando QR Code para a instância '${INSTANCE_NAME}'...`);

    try {
        const response = await axios.get(`${API_URL}/instance/connect/${INSTANCE_NAME}`, {
            headers: {
                'apikey': API_KEY
            }
        });

        console.log('DEBUG: Resposta da API:', JSON.stringify(response.data, null, 2));

        const qrCodeString = response.data.code;

        if (!qrCodeString) {
            console.error('❌ QR Code não encontrado no retorno da API.');
            return;
        }

        console.log('🖼️  Convertendo string em imagem...');
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeString)}`;

        const imageResponse = await axios.get(qrImageUrl, { responseType: 'arraybuffer' });

        const outputPath = path.join(process.cwd(), 'whatsapp-qr.png');
        fs.writeFileSync(outputPath, imageResponse.data);

        console.log(`✅ QR Code salvo com sucesso em: ${outputPath}`);
    } catch (err: any) {
        console.error('❌ Erro ao buscar QR Code:', err.response?.data || err.message);
    }
}

generateQR();
