import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'eberle_secret';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || 'EberleEats';

async function setup() {
    console.log(`🚀 Inicializando instância '${INSTANCE_NAME}' na Evolution API...`);

    try {
        // 1. Tenta criar a instância
        const response = await axios.post(`${API_URL}/instance/create`, {
            instanceName: INSTANCE_NAME,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true
        }, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            }
        });

        console.log('✅ Instância criada com sucesso!');
        console.log('🔗 Agora você precisa escanear o QR Code.');
        console.log(`\n👉 Acesse este link para ver o QR Code: ${API_URL}/instance/connect/${INSTANCE_NAME}?apikey=${API_KEY}\n`);

    } catch (err: any) {
        if (err.response?.data?.errors?.[0] === 'The instance already exists') {
            console.log(`ℹ️  A instância '${INSTANCE_NAME}' já existe. Tudo pronto.`);
            console.log(`🔗 Se não estiver conectado, veja o QR Code em: ${API_URL}/instance/connect/${INSTANCE_NAME}?apikey=${API_KEY}`);
        } else {
            console.error('❌ Erro ao criar instância:', err.response?.data || err.message);
            console.log('\nDica: Verifique se o Docker está rodando (docker-compose up -d)');
        }
    }
}

setup();
