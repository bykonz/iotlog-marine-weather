import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import MarineWeatherDataModel from '../src/data/models/MarineWeatherDataModel';
import MarineWeatherProcessService from '../src/services/MarineWeatherProcessService';

describe('MarineWeatherProcessService - Testes de Integração', () => {
  let mongoServer: MongoMemoryServer;

  // Configura o MongoDB em memória antes de todos os testes
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  // Limpa os dados antes de cada teste
  beforeEach(async () => {
    await MarineWeatherDataModel.deleteMany({});
  });

  // Fecha conexão e servidor após todos os testes
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  /**
   * Teste 1: Simula mensagem e valida salvamento no banco
   */
  test('Deve processar mensagem e salvar dados no MongoDB', async () => {
    // Simula payload de mensagem RabbitMQ
    const payload = {
      idAsset: 'VESSEL-001',
      _idAsset: '507f1f77bcf86cd799439011',
      latitude: -23.5505,
      longitude: -46.6333,
      date: '2024-12-01',
      timezone: 'America/Sao_Paulo',
    };

    // Processa a mensagem (chama API e salva no DB)
    await MarineWeatherProcessService.processAndSaveAsync(payload);

    // Busca os dados salvos no banco
    const savedData = await MarineWeatherDataModel.findOne({
      idAsset: payload.idAsset,
    });

    // Validações
    expect(savedData).not.toBeNull();
    expect(savedData?.idAsset).toBe('VESSEL-001');
    expect(savedData?.location.type).toBe('Point');
    expect(savedData?.location.coordinates).toEqual([
      payload.longitude,
      payload.latitude,
    ]);
    expect(savedData?.extra.dataType).toBe('marine_weather_conditions');
    expect(savedData?.extra.source).toBe('open-meteo');
    expect(savedData?.data).toBeDefined();
    expect(savedData?.data.hourly).toBeDefined();
  });

  /**
   * Teste 2: Valida estrutura dos dados salvos
   */
  test('Deve salvar dados com estrutura correta', async () => {
    const payload = {
      idAsset: 'VESSEL-002',
      latitude: -22.9068,
      longitude: -43.1729,
      date: '2024-12-05',
    };

    await MarineWeatherProcessService.processAndSaveAsync(payload);

    const savedData = await MarineWeatherDataModel.findOne({
      idAsset: 'VESSEL-002',
    });

    // Valida campos obrigatórios
    expect(savedData?.idAsset).toBe('VESSEL-002');
    expect(savedData?.date).toBeInstanceOf(Date);
    expect(savedData?.dateServer).toBeInstanceOf(Date);

    // Valida que data.hourly existe e contém condições meteorológicas
    expect(savedData?.data.hourly).toBeDefined();
    expect(savedData?.data.hourly.time).toBeDefined();
    expect(Array.isArray(savedData?.data.hourly.time)).toBe(true);

    // Valida extra
    expect(savedData?.extra.conditions).toBeDefined();
    expect(Array.isArray(savedData?.extra.conditions)).toBe(true);
    expect(savedData?.extra.dataType).toBe('marine_weather_conditions');
  });

  /**
   * Teste 3: Verifica atualização (upsert) de dados existentes
   */
  test('Deve atualizar dados existentes quando receber mensagem duplicada', async () => {
    const payload = {
      idAsset: 'VESSEL-003',
      latitude: -25.4284,
      longitude: -49.2733,
      date: '2024-12-03',
    };

    // Primeira inserção
    await MarineWeatherProcessService.processAndSaveAsync(payload);
    const firstSave = await MarineWeatherDataModel.findOne({
      idAsset: 'VESSEL-003',
    });

    // Segunda inserção (mesma data)
    await MarineWeatherProcessService.processAndSaveAsync(payload);
    const secondSave = await MarineWeatherDataModel.findOne({
      idAsset: 'VESSEL-003',
    });

    // Verifica que existe apenas um documento
    const count = await MarineWeatherDataModel.countDocuments({
      idAsset: 'VESSEL-003',
    });

    expect(count).toBe(1);
    expect(firstSave?._id.toString()).toBe(secondSave?._id.toString());
    expect(secondSave?.dateServer.getTime()).toBeGreaterThanOrEqual(
      firstSave?.dateServer.getTime() || 0
    );
  });
});
