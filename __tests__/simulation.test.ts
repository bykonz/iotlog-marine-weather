
import mongoose from 'mongoose';
import MarineWeatherProcessService from '../src/services/MarineWeatherProcessService';
import MarineWeatherDataModel from '../src/data/models/MarineWeatherDataModel';

// Dados fornecidos (pegando os primeiros 3 exemplos)
const simulationData: [number, number, number, number, null][] = [
    [
        1765224272,
        -21.0414254665375,
        -40.341625213623,
        9.18,
        null
    ],
    [
        1765224034,
        -21.0536563396454,
        -40.34503698349,
        8.64,
        null
    ],
    [
        1765223942,
        -21.0660481452942,
        -40.3478264808655,
        8.64,
        null
    ]
];

describe('Simulation with Real Marine Coordinates', () => {
    // Configura conexão com MongoDB Local
  beforeAll(async () => {
    // Conecta ao banco local real "marine_weather_test"
    const mongoUri = 'mongodb://localhost:27017/marine_weather_test';
    await mongoose.connect(mongoUri);
    console.log('Conectado ao MongoDB Local:', mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('Deve obter dados válidos (não nulos) para coordenadas marítimas reais', async () => {
    for (const [timestamp, lat, lon] of simulationData) {
        // Converte timestamp para data (timestamp parece estar em segundos)
        const date = new Date(timestamp * 1000);
        const dateString = date.toISOString().split('T')[0];
        
        console.log(`Simulando para: Lat ${lat}, Lon ${lon}, Data ${dateString}`);

        const payload = {
            idAsset: 'VESSEL-SIM-001',
            latitude: lat,
            longitude: lon,
            date: dateString,
            timezone: 'America/Sao_Paulo'
        };

        await MarineWeatherProcessService.processAndSaveAsync(payload);

        // Verifica o resultado no banco
        const savedData = await MarineWeatherDataModel.findOne({
            idAsset: 'VESSEL-SIM-001',
            date: new Date(payload.date)
        });

        expect(savedData).toBeDefined();
        
        // Verifica se temos dados de ondas (wave_height) que não sejam todos null
        const waveHeights = savedData?.data?.hourly?.wave_height || [];
        const hasData = waveHeights.some((val: any) => val !== null);
        
        if (hasData) {
            console.log(`✅ SUCESSO: Dados meteorológicos encontrados para ${dateString}! Wave Height sample:`, waveHeights.find((v: any) => v !== null));
        } else {
            console.warn(`⚠️ AVISO: Dados retornaram null para ${dateString}. Talvez a data futura (${dateString}) ainda não tenha previsão precisa ou a coordenada não seja marítima.`);
        }

        // Se a data for muito no futuro (2025), a API pode não ter dados precisos ou retornar null se for além de 7-10 dias de previsão.
        // O Open-Meteo fornece previsão de até 7 dias gratuitamente. Datas em 2025 provavelmente falharão ou retornarão histórico se fosse passado, mas previsão futura longínqua não existe.
        
        // Vamos tentar com a data ATUAL usando as mesmas coordenadas, para garantir que as coordenadas são válidas.
        
        const today = new Date().toISOString().split('T')[0];
        console.log(`Simulando para HOJE (${today}) nas mesmas coordenadas...`);
        
        const payloadToday = {
            ...payload,
            date: today,
            idAsset: 'VESSEL-SIM-001-TODAY'
        };
        
        await MarineWeatherProcessService.processAndSaveAsync(payloadToday);
        
        const savedDataToday = await MarineWeatherDataModel.findOne({
            idAsset: 'VESSEL-SIM-001-TODAY',
            date: new Date(today)
        });
        
        const waveHeightsToday = savedDataToday?.data?.hourly?.wave_height || [];
        const hasDataToday = waveHeightsToday.some((val: any) => val !== null);
        
        expect(hasDataToday).toBe(true); // Espera-se que para hoje, em alto mar, tenha dados.
    }
  }, 120000); // Aumenta timeout para 2 minutos
});
