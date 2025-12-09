import { ConsumeMessage } from 'amqplib';
import { z } from 'zod';
import loggerProvider from '../core/LoggerProvider';
import MessageQueueProvider from '../core/MessageQueueProvider';
import MarineWeatherProcessService from './MarineWeatherProcessService';

const _2min = 120000;

// Schema de validação do payload
const MarineWeatherPayloadSchema = z.object({
  idAsset: z.string(),
  _idAsset: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  date: z.string(), // ISO date string ou YYYY-MM-DD
  timezone: z.string().optional(),
});

class ConsumerService {
  async startConsumerAsync(): Promise<void> {
    MessageQueueProvider.onClose(() => {
      setTimeout(async () => {
        loggerProvider.info('Restarting queue bind after connection close');
        await this.startConsumers();
      }, _2min);
    });
    await this.startConsumers();
  }

  private async startConsumers(): Promise<void> {
    await this.consumeMarineWeatherQueue();
  }

  private async consumeMarineWeatherQueue(): Promise<void> {
    try {
      const channel = await MessageQueueProvider.createChannelAsync();
      
      const exchange = process.env.MARINE_WEATHER_EXCHANGE || 'marine_weather';
      const queue = process.env.MARINE_WEATHER_QUEUE || 'marine_weather_queue';

      // Declara exchange do tipo fanout
      await channel.assertExchange(exchange, 'fanout', {
        durable: true,
      });

      // Declara fila
      const q = await channel.assertQueue(queue, {
        durable: true,
        exclusive: false,
      });

      // Faz bind da fila ao exchange
      await channel.bindQueue(q.queue, exchange, '');

      // Configura prefetch
      channel.prefetch(1);

      loggerProvider.info(
        `Consumer started. Listening to queue: ${queue} on exchange: ${exchange}`
      );

      // Consome mensagens
      channel.consume(
        q.queue,
        async (msg: ConsumeMessage | null) => {
          if (msg?.content) {
            try {
              const payload = JSON.parse(msg.content.toString());
              
              loggerProvider.info(
                `Received message: ${JSON.stringify(payload)}`
              );

              // Valida o payload
              const validatedPayload = MarineWeatherPayloadSchema.parse(payload);

              // Processa os dados
              await MarineWeatherProcessService.processAndSaveAsync(
                validatedPayload
              );

              // Confirma mensagem (ACK)
              channel.ack(msg);
              
              loggerProvider.info(
                `Message processed successfully for asset: ${validatedPayload.idAsset}`
              );
            } catch (err) {
              if (err instanceof z.ZodError) {
                loggerProvider.error(
                  `Validation error for message: ${JSON.stringify(err.errors)}`
                );
              } else {
                loggerProvider.error(`Error processing message: ${err}`);
              }
              
              // Rejeita mensagem (NACK) - irá para dead letter ou será reprocessada
              channel.nack(msg, false, false);
            }
          }
        },
        {
          noAck: false,
          exclusive: false,
        }
      );
    } catch (err) {
      loggerProvider.error(`Error setting up consumer: ${err}`);
      throw err;
    }
  }
}

export default new ConsumerService();
