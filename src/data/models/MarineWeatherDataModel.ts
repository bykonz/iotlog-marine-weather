import { Schema, model, type Types } from 'mongoose';
import Collections from '../Collections';

export type MarineWeatherData = {
  id?: string;
  _idAsset: Types.ObjectId;
  idAsset: string;
  date: Date;
  dateServer: Date;
  location: {
    type: 'Point' | string;
    coordinates: number[]; // [longitude, latitude]
  };
  data: any; // Dados da API marine-api.open-meteo.com
  info?: unknown;
  extra: {
    dataType: string; // Tipo de dado salvo (ex: 'marine_weather_conditions')
    source?: string; // Fonte dos dados
    conditions?: string[]; // Lista de condições consultadas
  };
};

const MarineWeatherDataSchema = new Schema<MarineWeatherData>(
  {
    id: {
      type: Schema.Types.String,
      maxLength: 40,
    },
    _idAsset: {
      type: Schema.Types.ObjectId,
      ref: 'machine',
      required: true,
    },
    idAsset: {
      type: Schema.Types.String,
      maxLength: 20,
      required: true,
    },
    date: {
      type: Schema.Types.Date,
      required: true,
    },
    dateServer: {
      type: Schema.Types.Date,
      required: true,
    },
    location: {
      type: {
        type: Schema.Types.String,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
      },
    },
    data: { type: Object },
    info: { type: Object },
    extra: { type: Object },
  },
  {
    collection: Collections.MarineWeatherData,
    timestamps: true,
  }
);

// Índices adicionais para consultas eficientes
MarineWeatherDataSchema.index({ idAsset: 1, date: -1 });
MarineWeatherDataSchema.index({ _idAsset: 1, date: -1 });
MarineWeatherDataSchema.index({ 'location.coordinates': '2dsphere' });

export default model<MarineWeatherData>(
  Collections.MarineWeatherData,
  MarineWeatherDataSchema,
  Collections.MarineWeatherData
);
