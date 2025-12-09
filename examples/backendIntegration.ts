/**
 * Exemplo completo de integração do Marine Weather Service
 * com o iotlog-backend
 * 
 * Este arquivo mostra como:
 * 1. Publicar mensagens para coletar dados climáticos
 * 2. Agendar coletas automáticas
 * 3. Integrar com rotas de viagem
 */

import amqp from 'amqplib';
import moment from 'moment';

// ==========================================
// 1. Publisher Service
// ==========================================

class MarineWeatherPublisher {
  private rabbitUrl: string;
  private exchange: string;

  constructor() {
    this.rabbitUrl = process.env.MESSAGE_QUEU_HOST 
      ? `amqp://${process.env.MESSAGE_QUEU_USER}:${process.env.MESSAGE_QUEU_PASSWORD}@${process.env.MESSAGE_QUEU_HOST}:${process.env.MESSAGE_QUEU_PORT}`
      : 'amqp://guest:guest@localhost:5672';
    this.exchange = 'marine_weather';
  }

  async publishWeatherRequest(data: {
    idAsset: string;
    _idAsset?: string;
    latitude: number;
    longitude: number;
    date: string;
    timezone?: string;
  }): Promise<void> {
    try {
      const connection = await amqp.connect(this.rabbitUrl);
      const channel = await connection.createChannel();

      await channel.assertExchange(this.exchange, 'fanout', { durable: true });

      const message = JSON.stringify(data);
      channel.publish(this.exchange, '', Buffer.from(message), {
        persistent: true,
      });

      console.log(`✅ Weather request published for asset: ${data.idAsset}`);

      await channel.close();
      await connection.close();
    } catch (err) {
      console.error('❌ Error publishing weather request:', err);
      throw err;
    }
  }

  async publishBatchRequests(requests: any[]): Promise<void> {
    const connection = await amqp.connect(this.rabbitUrl);
    const channel = await connection.createChannel();

    await channel.assertExchange(this.exchange, 'fanout', { durable: true });

    for (const request of requests) {
      const message = JSON.stringify(request);
      channel.publish(this.exchange, '', Buffer.from(message), {
        persistent: true,
      });
    }

    console.log(`✅ Published ${requests.length} weather requests`);

    await channel.close();
    await connection.close();
  }
}

// ==========================================
// 2. Uso em Travel Router
// ==========================================

/**
 * Quando uma viagem é criada ou atualizada,
 * solicitar dados climáticos para toda a rota
 */
async function requestWeatherForTravelRoute(travel: {
  idMachine: string;
  _idMachine: string;
  route: {
    coordinates: [number, number][]; // [[lon, lat], ...]
  };
  startedAt: Date;
  endedAt?: Date;
}) {
  const publisher = new MarineWeatherPublisher();
  const requests = [];

  // Se não tem data de fim, usa hoje + 7 dias
  const endDate = travel.endedAt || moment().add(7, 'days').toDate();
  
  // Criar requests para cada dia da viagem
  let currentDate = moment(travel.startedAt);
  const finalDate = moment(endDate);

  while (currentDate.isSameOrBefore(finalDate)) {
    // Para cada ponto da rota (ou apenas alguns pontos chave)
    // Vamos pegar a cada 10 pontos para não sobrecarregar
    const pointsToCheck = travel.route.coordinates.filter(
      (_, index) => index % 10 === 0
    );

    for (const [lon, lat] of pointsToCheck) {
      requests.push({
        idAsset: travel.idMachine,
        _idAsset: travel._idMachine,
        latitude: lat,
        longitude: lon,
        date: currentDate.format('YYYY-MM-DD'),
      });
    }

    currentDate.add(1, 'day');
  }

  console.log(`📡 Requesting weather for ${requests.length} points`);
  await publisher.publishBatchRequests(requests);
}

// ==========================================
// 3. Scheduler Diário
// ==========================================

/**
 * Agendar coleta diária de dados climáticos
 * para todas as embarcações ativas
 */
import cron from 'node-cron';
// import machineRepository from '../domain/repositories/machine-repository';
// import lastPositionService from '../domain/services/last-position-service';

class MarineWeatherScheduler {
  private publisher: MarineWeatherPublisher;

  constructor() {
    this.publisher = new MarineWeatherPublisher();
  }

  async collectDailyWeatherForAllVessels() {
    console.log('🌊 Starting daily marine weather collection...');

    try {
      // Buscar todas as embarcações ativas
      // const vessels = await machineRepository.findAsync({
      //   type: 'vessel',
      //   isActive: true,
      // });

      // Exemplo mockado
      const vessels = [
        { id: 'VESSEL-001', _id: '507f1f77bcf86cd799439011' },
        { id: 'VESSEL-002', _id: '507f1f77bcf86cd799439012' },
      ];

      const requests = [];

      for (const vessel of vessels) {
        try {
          // Buscar última posição conhecida
          // const lastPosition = await lastPositionService.getLastPosition(vessel.id);
          
          // Exemplo mockado
          const lastPosition = {
            latitude: -23.5505,
            longitude: -46.6333,
          };

          if (lastPosition) {
            // Coletar dados para hoje e próximos 7 dias
            for (let i = 0; i < 7; i++) {
              requests.push({
                idAsset: vessel.id,
                _idAsset: vessel._id,
                latitude: lastPosition.latitude,
                longitude: lastPosition.longitude,
                date: moment().add(i, 'days').format('YYYY-MM-DD'),
              });
            }
          }
        } catch (err) {
          console.error(`Error processing vessel ${vessel.id}:`, err);
        }
      }

      if (requests.length > 0) {
        await this.publisher.publishBatchRequests(requests);
        console.log(`✅ Scheduled weather collection for ${vessels.length} vessels`);
      }
    } catch (err) {
      console.error('❌ Error in daily weather collection:', err);
    }
  }

  startScheduler() {
    // Executar todos os dias às 6h da manhã
    cron.schedule('0 6 * * *', async () => {
      await this.collectDailyWeatherForAllVessels();
    });

    console.log('⏰ Marine weather scheduler started (runs daily at 6 AM)');
  }
}

// ==========================================
// 4. Controller para API Manual
// ==========================================

/**
 * Endpoint para solicitar dados climáticos manualmente
 * POST /api/v1/marine-weather/request
 */
class RequestMarineWeatherController {
  async execute(req: any, res: any) {
    try {
      const { idAsset, latitude, longitude, date } = req.body;

      if (!idAsset || !latitude || !longitude || !date) {
        res.status(400).json({
          message: 'Missing required fields',
          code: 'validation.error',
        });
        return;
      }

      const publisher = new MarineWeatherPublisher();
      
      await publisher.publishWeatherRequest({
        idAsset,
        latitude,
        longitude,
        date,
      });

      res.status(200).json({
        message: 'Weather data request queued successfully',
        code: 'request.queued',
      });
    } catch (err) {
      console.error('Error requesting weather data:', err);
      res.status(500).json({
        message: 'Error requesting weather data',
        code: 'error.request',
      });
    } finally {
      res.end();
    }
  }
}

// ==========================================
// 5. Exemplo de Uso Completo
// ==========================================

async function exampleUsage() {
  console.log('🚀 Marine Weather Integration Examples\n');

  const publisher = new MarineWeatherPublisher();

  // Exemplo 1: Solicitar dados para uma embarcação agora
  console.log('Example 1: Request weather for today');
  await publisher.publishWeatherRequest({
    idAsset: 'VESSEL-001',
    _idAsset: '507f1f77bcf86cd799439011',
    latitude: -23.5505,
    longitude: -46.6333,
    date: moment().format('YYYY-MM-DD'),
  });

  // Exemplo 2: Solicitar previsão para próximos 7 dias
  console.log('\nExample 2: Request forecast for next 7 days');
  const forecastRequests = [];
  for (let i = 0; i < 7; i++) {
    forecastRequests.push({
      idAsset: 'VESSEL-001',
      _idAsset: '507f1f77bcf86cd799439011',
      latitude: -23.5505,
      longitude: -46.6333,
      date: moment().add(i, 'days').format('YYYY-MM-DD'),
    });
  }
  await publisher.publishBatchRequests(forecastRequests);

  // Exemplo 3: Solicitar dados para uma rota de viagem
  console.log('\nExample 3: Request weather for travel route');
  await requestWeatherForTravelRoute({
    idMachine: 'VESSEL-001',
    _idMachine: '507f1f77bcf86cd799439011',
    route: {
      coordinates: [
        [-46.6333, -23.5505], // São Paulo
        [-43.1729, -22.9068], // Rio de Janeiro
        [-38.5014, -3.7172],  // Fortaleza
      ],
    },
    startedAt: new Date(),
    endedAt: moment().add(5, 'days').toDate(),
  });

  // Exemplo 4: Iniciar scheduler
  console.log('\nExample 4: Start daily scheduler');
  const scheduler = new MarineWeatherScheduler();
  scheduler.startScheduler();

  console.log('\n✅ All examples completed!');
}

// Executar exemplos
if (require.main === module) {
  exampleUsage().catch(console.error);
}

export {
  MarineWeatherPublisher,
  MarineWeatherScheduler,
  RequestMarineWeatherController,
  requestWeatherForTravelRoute,
};
