import mongoose from 'mongoose';
import loggerProvider from './LoggerProvider';

class DatabaseProvider {
  private connection: typeof mongoose | null = null;

  async connectAsync(): Promise<typeof mongoose> {
    if (this.connection) {
      return this.connection;
    }

    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGO_DB_NAME || 'marine_weather';
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASSWORD;

    const options: any = {
      dbName,
    };

    if (user && password) {
      options.auth = { username: user, password };
    }

    try {
      this.connection = await mongoose.connect(uri, options);
      
      mongoose.connection.on('error', (err) => {
        loggerProvider.error(`MongoDB connection error: ${err}`);
      });

      mongoose.connection.on('disconnected', () => {
        loggerProvider.warn('MongoDB disconnected');
        this.connection = null;
      });

      loggerProvider.info(`Connected to MongoDB: ${dbName}`);
      return this.connection;
    } catch (err) {
      loggerProvider.error(`Failed to connect to MongoDB: ${err}`);
      throw err;
    }
  }

  async closeAsync(): Promise<void> {
    if (this.connection) {
      await mongoose.connection.close();
      this.connection = null;
    }
  }
}

export default new DatabaseProvider();
