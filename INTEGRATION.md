# Guia de Integração - Marine Weather Service

## 🔌 Como Integrar com o Sistema IOTLOG

### 1. Publicar Mensagens de Outros Microserviços

Para enviar dados de embarcações para processamento de clima marítimo:

#### Do iotlog-backend (Node.js/TypeScript)

```typescript
import amqp from 'amqplib';

async function requestMarineWeather(data: {
  idAsset: string;
  _idAsset?: string;
  latitude: number;
  longitude: number;
  date: string;
}) {
  const connection = await amqp.connect(process.env.MESSAGE_QUEU_HOST || 'localhost');
  const channel = await connection.createChannel();
  
  const exchange = 'marine_weather';
  await channel.assertExchange(exchange, 'fanout', { durable: true });
  
  channel.publish(
    exchange,
    '',
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
  
  await channel.close();
  await connection.close();
}

// Uso em um controller ou service
await requestMarineWeather({
  idAsset: machine.id,
  _idAsset: machine._id.toString(),
  latitude: position.latitude,
  longitude: position.longitude,
  date: new Date().toISOString(),
});
```

### 2. Agendar Coleta Diária de Dados

Para coletar dados climáticos automaticamente para todas as embarcações:

```typescript
// iotlog-backend/domain/services/marine-weather-scheduler.ts
import cron from 'node-cron';
import machineRepository from '../repositories/machine-repository';
import lastPositionService from './last-position-service';
import { publishMarineWeatherRequest } from './marine-weather-publisher';

class MarineWeatherScheduler {
  async scheduleDaily() {
    // Executa todos os dias às 6h da manhã
    cron.schedule('0 6 * * *', async () => {
      console.log('Running marine weather data collection...');
      
      // Busca todas as embarcações ativas
      const vessels = await machineRepository.findAsync({
        type: 'vessel',
        isActive: true,
      });
      
      for (const vessel of vessels) {
        try {
          // Busca última posição conhecida
          const lastPosition = await lastPositionService.getLastPosition(vessel.id);
          
          if (lastPosition) {
            await publishMarineWeatherRequest({
              idAsset: vessel.id,
              _idAsset: vessel._id.toString(),
              latitude: lastPosition.latitude,
              longitude: lastPosition.longitude,
              date: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error(`Error requesting weather for ${vessel.id}:`, err);
        }
      }
      
      console.log(`Marine weather data requested for ${vessels.length} vessels`);
    });
  }
}

export default new MarineWeatherScheduler();
```

### 3. Consultar Dados Históricos

#### Do iotlog-backend

```typescript
// iotlog-backend/domain/services/marine-weather-query.ts
import mongoose from 'mongoose';

const MarineWeatherDataModel = mongoose.model('marineWeatherData');

class MarineWeatherQueryService {
  async getWeatherHistory(idAsset: string, startDate: Date, endDate: Date) {
    return await MarineWeatherDataModel.find({
      idAsset,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ date: -1 })
      .lean();
  }
  
  async getLatestWeather(idAsset: string) {
    return await MarineWeatherDataModel.findOne({ idAsset })
      .sort({ date: -1 })
      .lean();
  }
}

export default new MarineWeatherQueryService();
```

#### Criar Router no Backend

```typescript
// iotlog-backend/routes/marine-weather-router.ts
import express from 'express';
import marineWeatherQueryService from '../domain/services/marine-weather-query';

const router = express.Router();

// GET /api/v1/marine-weather/history/:idAsset
router.get('/history/:idAsset', async (req, res) => {
  try {
    const { idAsset } = req.params;
    const { startDate, endDate } = req.query;
    
    const data = await marineWeatherQueryService.getWeatherHistory(
      idAsset,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching weather history' });
  }
});

// GET /api/v1/marine-weather/latest/:idAsset
router.get('/latest/:idAsset', async (req, res) => {
  try {
    const { idAsset } = req.params;
    const data = await marineWeatherQueryService.getLatestWeather(idAsset);
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching latest weather' });
  }
});

export default router;
```

Registrar no `app.ts`:
```typescript
import marineWeatherRouter from './routes/marine-weather-router';
app.use('/api/v1/marine-weather', verifyJWT, marineWeatherRouter);
```

### 4. Exibir Dados no Frontend

#### Service no Frontend

```javascript
// iotlog-frontend/src/services/MarineWeatherService.js
import { Fetch } from '../components';

export const getMarineWeatherHistory = async (idAsset, startDate, endDate) => {
  const response = await Fetch.get('/marine-weather/history/' + idAsset, {
    params: { startDate, endDate }
  });
  return response.data;
};

export const getLatestMarineWeather = async (idAsset) => {
  const response = await Fetch.get('/marine-weather/latest/' + idAsset);
  return response.data;
};
```

#### Componente React

```jsx
// iotlog-frontend/src/pages/fleet/MarineWeather.jsx
import React, { useState, useEffect } from 'react';
import { getLatestMarineWeather } from '../../services/MarineWeatherService';

function MarineWeatherWidget({ idAsset }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadWeather() {
      try {
        const data = await getLatestMarineWeather(idAsset);
        setWeather(data);
      } catch (err) {
        console.error('Error loading weather:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWeather();
  }, [idAsset]);
  
  if (loading) return <div>Loading...</div>;
  if (!weather) return <div>No weather data available</div>;
  
  // Pega o último horário disponível
  const lastIndex = weather.data.hourly.time.length - 1;
  
  return (
    <div>
      <h3>Marine Weather Conditions</h3>
      <p>Date: {new Date(weather.date).toLocaleDateString()}</p>
      <p>Wave Height: {weather.data.hourly.wave_height[lastIndex]}m</p>
      <p>Wind Wave Height: {weather.data.hourly.wind_wave_height[lastIndex]}m</p>
      <p>Swell Wave Height: {weather.data.hourly.swell_wave_height[lastIndex]}m</p>
      <p>Ocean Current: {weather.data.hourly.ocean_current_velocity[lastIndex]} kn</p>
    </div>
  );
}

export default MarineWeatherWidget;
```

### 5. Monitoramento e Logs

#### Verificar Mensagens Processadas

```bash
# Ver logs do serviço
docker logs -f iotlog-marine-weather

# Ou se rodando localmente
yarn dev
```

#### Consultar MongoDB

```javascript
// Conectar ao MongoDB
mongosh mongodb://localhost:27017/marine_weather

// Ver total de registros
db.marineWeatherData.countDocuments()

// Ver últimos 10 registros
db.marineWeatherData.find().sort({ date: -1 }).limit(10)

// Ver registros de um ativo específico
db.marineWeatherData.find({ idAsset: "VESSEL-001" }).sort({ date: -1 })
```

### 6. Troubleshooting

#### Mensagens não estão sendo processadas

1. Verificar se RabbitMQ está rodando:
```bash
curl http://localhost:15672/api/overview
```

2. Verificar se a fila existe:
```bash
# Acessar RabbitMQ Management
# http://localhost:15672 (guest/guest)
```

3. Verificar logs do serviço:
```bash
docker logs iotlog-marine-weather
```

#### Dados não estão sendo salvos

1. Verificar conexão com MongoDB:
```bash
mongosh mongodb://localhost:27017/marine_weather --eval "db.adminCommand('ping')"
```

2. Verificar permissões:
```bash
# Se usando autenticação, verificar usuário/senha no .env
```

#### API retornando erro

1. Testar API diretamente:
```bash
curl "https://marine-api.open-meteo.com/v1/marine?latitude=-23.5505&longitude=-46.6333&hourly=wave_height&start_date=2025-12-09&end_date=2025-12-09"
```

2. Verificar se coordenadas são válidas (latitude: -90 a 90, longitude: -180 a 180)

---

## 📊 Fluxo Completo

```
┌─────────────────┐
│ iotlog-backend  │
│  (Scheduler ou  │
│   Manual API)   │
└────────┬────────┘
         │
         │ Publica mensagem
         ▼
┌─────────────────┐
│   RabbitMQ      │
│  (Exchange:     │
│ marine_weather) │
└────────┬────────┘
         │
         │ Consome mensagem
         ▼
┌──────────────────────┐
│ iotlog-marine-       │
│   weather service    │
└────────┬─────────────┘
         │
         │ 1. Valida dados
         │ 2. Chama API Open-Meteo
         │ 3. Salva no MongoDB
         ▼
┌──────────────────────┐
│   MongoDB            │
│ (marineWeatherData)  │
└────────┬─────────────┘
         │
         │ Consulta via API
         ▼
┌──────────────────────┐
│ iotlog-backend       │
│  (API endpoints)     │
└────────┬─────────────┘
         │
         │ HTTP Request
         ▼
┌──────────────────────┐
│ iotlog-frontend      │
│  (Dashboard/UI)      │
└──────────────────────┘
```

---

## 🚀 Quick Start para Testar

1. **Configurar e Iniciar Serviço**
```bash
cd iotlog-marine-weather
cp .env.example .env
yarn install
yarn dev
```

2. **Publicar Mensagem de Teste**
```bash
# Em outro terminal
cd iotlog-marine-weather
npx tsx examples/publishMessage.ts
```

3. **Consultar Dados**
```bash
npx tsx examples/queryData.ts
```

4. **Ver no MongoDB**
```bash
mongosh mongodb://localhost:27017/marine_weather
db.marineWeatherData.find().pretty()
```

---

**Pronto para produção!** 🌊⛵
