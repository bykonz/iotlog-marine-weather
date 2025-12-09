/**
 * Script de exemplo para publicar mensagens no RabbitMQ
 * para serem processadas pelo marine-weather service
 */

import amqp from 'amqplib';

const EXCHANGE = 'marine_weather';
const RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';

async function publishMarineWeatherRequest(data: {
  idAsset: string;
  _idAsset?: string;
  latitude: number;
  longitude: number;
  date: string;
  timezone?: string;
}) {
  try {
    // Conecta ao RabbitMQ
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Declara exchange
    await channel.assertExchange(EXCHANGE, 'fanout', { durable: true });

    // Publica mensagem
    const message = JSON.stringify(data);
    channel.publish(EXCHANGE, '', Buffer.from(message), {
      persistent: true,
    });

    console.log(`Message published: ${message}`);

    // Fecha conexão
    await channel.close();
    await connection.close();
  } catch (err) {
    console.error('Error publishing message:', err);
    throw err;
  }
}

// Exemplo de uso
async function main() {
  // Exemplo 1: Dados para o dia de hoje
  await publishMarineWeatherRequest({
    idAsset: 'VESSEL-001',
    _idAsset: '507f1f77bcf86cd799439011',
    latitude: -23.5505,
    longitude: -46.6333,
    date: '2025-12-09',
    timezone: 'America/Sao_Paulo',
  });

  // Exemplo 2: Múltiplas datas
  const dates = ['2025-12-09', '2025-12-10', '2025-12-11'];
  for (const date of dates) {
    await publishMarineWeatherRequest({
      idAsset: 'VESSEL-002',
      latitude: -22.9068,
      longitude: -43.1729,
      date,
    });
  }

  console.log('All messages published successfully');
}

// Executa apenas se for chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { publishMarineWeatherRequest };
