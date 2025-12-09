import axios from 'axios';
import moment from 'moment-timezone';
import loggerProvider from '../core/LoggerProvider';

const conditions = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
  'wind_wave_peak_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'swell_wave_peak_period',
  'ocean_current_velocity',
  'ocean_current_direction',
];

export type MarineWeatherParams = {
  latitude: number;
  longitude: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  timezone?: string;
};

export type MarineWeatherResponse = {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: {
    [key: string]: string;
  };
  hourly: {
    time: string[];
    [key: string]: any;
  };
};

class MarineWeatherApiService {
  private readonly apiUrl = 'https://marine-api.open-meteo.com/v1/marine';

  async getWeatherConditionsAsync(
    params: MarineWeatherParams
  ): Promise<MarineWeatherResponse> {
    try {
      const { latitude, longitude, startDate, endDate, timezone } = params;

      // Se não houver timezone, tenta adivinhar
      const tz = timezone || moment.tz.guess();

      // Se não houver endDate, usa o mesmo que startDate
      const finalEndDate = endDate || startDate;

      const url = new URL(this.apiUrl);
      url.searchParams.append('latitude', latitude.toString());
      url.searchParams.append('longitude', longitude.toString());
      url.searchParams.append('hourly', conditions.join(','));
      url.searchParams.append('start_date', startDate);
      url.searchParams.append('end_date', finalEndDate);
      url.searchParams.append('wind_speed_unit', 'kn');
      url.searchParams.append('timezone', tz);

      loggerProvider.info(`Fetching marine weather data: ${url.toString()}`);

      const response = await axios.get<MarineWeatherResponse>(url.toString(), {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      loggerProvider.info(
        `Marine weather data fetched successfully for lat: ${latitude}, lon: ${longitude}`
      );

      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        loggerProvider.error(
          `Axios error fetching marine weather: ${err.message}`
        );
        if (err.response) {
          loggerProvider.error(`Response status: ${err.response.status}`);
          loggerProvider.error(`Response data: ${JSON.stringify(err.response.data)}`);
        }
      } else {
        loggerProvider.error(`Error fetching marine weather: ${err}`);
      }
      throw err;
    }
  }
}

export default new MarineWeatherApiService();
