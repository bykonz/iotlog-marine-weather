/**
 * Script de exemplo para consultar dados históricos do banco
 */

import 'dotenv/config';
import DatabaseProvider from '../src/core/DatabaseProvider';
import MarineWeatherQueryService from '../src/services/MarineWeatherQueryService';

async function main() {
  try {
    // Conecta ao banco
    await DatabaseProvider.connectAsync();
    console.log('Connected to database');

    // Exemplo 1: Buscar últimos registros de um ativo
    console.log('\n--- Exemplo 1: Últimos registros de VESSEL-001 ---');
    const latest = await MarineWeatherQueryService.findLatestByAssetAsync(
      'VESSEL-001'
    );
    console.log('Latest record:', JSON.stringify(latest, null, 2));

    // Exemplo 2: Buscar histórico de um ativo
    console.log('\n--- Exemplo 2: Histórico de VESSEL-001 ---');
    const history = await MarineWeatherQueryService.findByAssetAsync({
      idAsset: 'VESSEL-001',
      limit: 10,
    });
    console.log(`Found ${history.length} records`);
    history.forEach((record) => {
      console.log(
        `- Date: ${record.date}, Location: [${record.location.coordinates}]`
      );
    });

    // Exemplo 3: Buscar por período
    console.log('\n--- Exemplo 3: Registros de dezembro ---');
    const decemberRecords = await MarineWeatherQueryService.findByAssetAsync({
      idAsset: 'VESSEL-001',
      startDate: new Date('2025-12-01'),
      endDate: new Date('2025-12-31'),
    });
    console.log(`Found ${decemberRecords.length} records in December`);

    // Exemplo 4: Buscar por localização
    console.log('\n--- Exemplo 4: Registros próximos a São Paulo ---');
    const nearSaoPaulo = await MarineWeatherQueryService.findByLocationAsync({
      latitude: -23.5505,
      longitude: -46.6333,
      maxDistance: 50000, // 50km
      limit: 5,
    });
    console.log(`Found ${nearSaoPaulo.length} records near São Paulo`);

    // Exemplo 5: Contar total de registros
    console.log('\n--- Exemplo 5: Total de registros ---');
    const count = await MarineWeatherQueryService.countByAssetAsync('VESSEL-001');
    console.log(`Total records for VESSEL-001: ${count}`);

    // Exemplo 6: Buscar data específica
    console.log('\n--- Exemplo 6: Dados de uma data específica ---');
    const specificDate = await MarineWeatherQueryService.findByDateAsync(
      'VESSEL-001',
      new Date('2025-12-09')
    );
    if (specificDate) {
      console.log('Weather conditions:');
      console.log(`- Wave height max: ${Math.max(...specificDate.data.hourly.wave_height || [0])}m`);
      console.log(`- Wind wave height max: ${Math.max(...specificDate.data.hourly.wind_wave_height || [0])}m`);
      console.log(`- Swell wave height max: ${Math.max(...specificDate.data.hourly.swell_wave_height || [0])}m`);
    }

    await DatabaseProvider.closeAsync();
    console.log('\nDisconnected from database');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
