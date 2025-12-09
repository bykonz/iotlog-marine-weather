import { Types } from 'mongoose';
import moment from 'moment';
import loggerProvider from '../core/LoggerProvider';
import MarineWeatherDataModel from '../data/models/MarineWeatherDataModel';
import MarineWeatherApiService from './MarineWeatherApiService';

export type ProcessWeatherPayload = {
  idAsset: string;
  _idAsset?: string; // ObjectId opcional
  latitude: number;
  longitude: number;
  date: string; // Data em formato YYYY-MM-DD ou ISO
  timezone?: string;
};

class MarineWeatherProcessService {
  async processAndSaveAsync(payload: ProcessWeatherPayload): Promise<void> {
    try {
      const { idAsset, _idAsset, latitude, longitude, date, timezone } = payload;

      loggerProvider.info(
        `Processing marine weather for asset: ${idAsset}, date: ${date}, lat: ${latitude}, lon: ${longitude}`
      );

      // Formata a data para o formato esperado pela API (YYYY-MM-DD)
      const dateFormatted = moment(date).format('YYYY-MM-DD');

      // Busca os dados da API
      const weatherData = await MarineWeatherApiService.getWeatherConditionsAsync({
        latitude,
        longitude,
        startDate: dateFormatted,
        endDate: dateFormatted,
        timezone,
      });

      // Prepara os dados para salvar no MongoDB
      const dataToSave = {
        id: `marine-weather-${idAsset}-${dateFormatted}`,
        _idAsset: _idAsset ? new Types.ObjectId(_idAsset) : new Types.ObjectId(),
        idAsset,
        date: new Date(date),
        dateServer: new Date(),
        location: {
          type: 'Point',
          coordinates: [longitude, latitude], // GeoJSON: [longitude, latitude]
        },
        data: weatherData, // Toda a resposta da API
        info: {
          apiSource: 'marine-api.open-meteo.com',
          requestedDate: dateFormatted,
          processedAt: new Date(),
        },
        extra: {
          dataType: 'marine_weather_conditions',
          source: 'open-meteo',
          conditions: Object.keys(weatherData.hourly).filter(
            (key) => key !== 'time'
          ),
          timezone: weatherData.timezone,
          elevation: weatherData.elevation,
        },
      };

      // Salva no MongoDB (ou atualiza se já existir)
      await MarineWeatherDataModel.findOneAndUpdate(
        {
          idAsset,
          date: new Date(date),
        },
        dataToSave,
        {
          upsert: true,
          new: true,
        }
      );

      loggerProvider.info(
        `Marine weather data saved successfully for asset: ${idAsset}, date: ${dateFormatted}`
      );
    } catch (err) {
      loggerProvider.error(
        `Error processing marine weather data for asset ${payload.idAsset}: ${err}`
      );
      throw err;
    }
  }
}

export default new MarineWeatherProcessService();
