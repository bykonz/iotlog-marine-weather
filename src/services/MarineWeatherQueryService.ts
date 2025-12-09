import { Types } from 'mongoose';
import MarineWeatherDataModel, {
  type MarineWeatherData,
} from '../data/models/MarineWeatherDataModel';
import loggerProvider from '../core/LoggerProvider';

export type QueryParams = {
  idAsset?: string;
  _idAsset?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
};

export type LocationQueryParams = {
  longitude: number;
  latitude: number;
  maxDistance?: number; // em metros
  startDate?: Date;
  endDate?: Date;
  limit?: number;
};

class MarineWeatherQueryService {
  /**
   * Busca dados históricos de clima marítimo por ID do ativo
   */
  async findByAssetAsync(
    params: QueryParams
  ): Promise<MarineWeatherData[]> {
    try {
      const { idAsset, _idAsset, startDate, endDate, limit = 100 } = params;

      const query: any = {};

      if (idAsset) {
        query.idAsset = idAsset;
      }

      if (_idAsset) {
        query._idAsset = new Types.ObjectId(_idAsset);
      }

      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = startDate;
        }
        if (endDate) {
          query.date.$lte = endDate;
        }
      }

      const results = await MarineWeatherDataModel.find(query)
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      loggerProvider.info(
        `Found ${results.length} weather records for query: ${JSON.stringify(params)}`
      );

      return results;
    } catch (err) {
      loggerProvider.error(`Error querying weather data: ${err}`);
      throw err;
    }
  }

  /**
   * Busca dados por localização (geoespacial)
   */
  async findByLocationAsync(
    params: LocationQueryParams
  ): Promise<MarineWeatherData[]> {
    try {
      const {
        longitude,
        latitude,
        maxDistance = 10000,
        startDate,
        endDate,
        limit = 100,
      } = params;

      const query: any = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      };

      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = startDate;
        }
        if (endDate) {
          query.date.$lte = endDate;
        }
      }

      const results = await MarineWeatherDataModel.find(query)
        .limit(limit)
        .lean();

      loggerProvider.info(
        `Found ${results.length} weather records near location [${longitude}, ${latitude}]`
      );

      return results;
    } catch (err) {
      loggerProvider.error(`Error querying weather data by location: ${err}`);
      throw err;
    }
  }

  /**
   * Busca último registro de clima para um ativo
   */
  async findLatestByAssetAsync(idAsset: string): Promise<MarineWeatherData | null> {
    try {
      const result = await MarineWeatherDataModel.findOne({ idAsset })
        .sort({ date: -1 })
        .lean();

      if (result) {
        loggerProvider.info(
          `Found latest weather record for asset ${idAsset}: ${result.date}`
        );
      }

      return result;
    } catch (err) {
      loggerProvider.error(`Error querying latest weather data: ${err}`);
      throw err;
    }
  }

  /**
   * Busca dados de uma data específica
   */
  async findByDateAsync(
    idAsset: string,
    date: Date
  ): Promise<MarineWeatherData | null> {
    try {
      const result = await MarineWeatherDataModel.findOne({
        idAsset,
        date,
      }).lean();

      if (result) {
        loggerProvider.info(
          `Found weather record for asset ${idAsset} on date ${date}`
        );
      }

      return result;
    } catch (err) {
      loggerProvider.error(`Error querying weather data by date: ${err}`);
      throw err;
    }
  }

  /**
   * Conta registros de um ativo
   */
  async countByAssetAsync(idAsset: string): Promise<number> {
    try {
      const count = await MarineWeatherDataModel.countDocuments({ idAsset });
      loggerProvider.info(`Asset ${idAsset} has ${count} weather records`);
      return count;
    } catch (err) {
      loggerProvider.error(`Error counting weather records: ${err}`);
      throw err;
    }
  }
}

export default new MarineWeatherQueryService();
