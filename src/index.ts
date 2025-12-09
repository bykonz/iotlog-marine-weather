import 'dotenv/config';
import loggerProvider from './core/LoggerProvider';
import DatabaseProvider from './core/DatabaseProvider';
import ConsumerService from './services/ConsumerService';

async function main() {
  try {
    loggerProvider.info('Starting IoTLog Marine Weather Service...');

    // Conecta ao MongoDB
    await DatabaseProvider.connectAsync();

    // Inicia o consumer de mensagens
    await ConsumerService.startConsumerAsync();

    loggerProvider.info('IoTLog Marine Weather Service started successfully');
  } catch (err) {
    loggerProvider.error(`Failed to start service: ${err}`);
    process.exit(1);
  }
}

// Tratamento de sinais para shutdown gracioso
process.on('SIGTERM', async () => {
  loggerProvider.info('SIGTERM received, shutting down gracefully...');
  await DatabaseProvider.closeAsync();
  process.exit(0);
});

process.on('SIGINT', async () => {
  loggerProvider.info('SIGINT received, shutting down gracefully...');
  await DatabaseProvider.closeAsync();
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  loggerProvider.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  loggerProvider.error(`Uncaught Exception: ${err}`);
  process.exit(1);
});

// Inicia a aplicação
main();
