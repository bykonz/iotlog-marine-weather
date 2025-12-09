import amqp, { Channel, Connection } from 'amqplib';
import loggerProvider from './LoggerProvider';

class MessageQueueProvider {
  private connection: Connection | null = null;
  private closeCallbacks: Array<() => void> = [];

  async connectAsync(): Promise<Connection> {
    if (this.connection) {
      return this.connection;
    }

    const protocol = process.env.MESSAGE_QUEUE_PROTOCOL || 'amqp';
    const host = process.env.MESSAGE_QUEUE_HOST || 'localhost';
    const port = process.env.MESSAGE_QUEUE_PORT || '5672';
    const user = process.env.MESSAGE_QUEUE_USER || 'guest';
    const password = process.env.MESSAGE_QUEUE_PASSWORD || 'guest';

    const url = `${protocol}://${user}:${password}@${host}:${port}`;

    try {
      this.connection = await amqp.connect(url);
      
      this.connection.on('close', () => {
        loggerProvider.warn('RabbitMQ connection closed');
        this.connection = null;
        this.closeCallbacks.forEach(callback => callback());
      });

      this.connection.on('error', (err) => {
        loggerProvider.error(`RabbitMQ connection error: ${err.message}`);
      });

      loggerProvider.info('Connected to RabbitMQ');
      return this.connection;
    } catch (err) {
      loggerProvider.error(`Failed to connect to RabbitMQ: ${err}`);
      throw err;
    }
  }

  async createChannelAsync(): Promise<Channel> {
    const connection = await this.connectAsync();
    return await connection.createChannel();
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  async closeAsync(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}

export default new MessageQueueProvider();
