# iotlog-marine-weather - Resumo da Implementação

## ✅ Microserviço Completo Criado

### 📂 Estrutura do Projeto

```
iotlog-marine-weather/
├── src/
│   ├── core/
│   │   ├── DatabaseProvider.ts          # Conexão MongoDB
│   │   ├── LoggerProvider.ts            # Winston logger
│   │   └── MessageQueueProvider.ts      # RabbitMQ connection
│   ├── data/
│   │   ├── Collections.ts               # Constantes de coleções
│   │   └── models/
│   │       └── MarineWeatherDataModel.ts # Schema Mongoose
│   ├── services/
│   │   ├── ConsumerService.ts           # Consumer RabbitMQ
│   │   ├── MarineWeatherApiService.ts   # Client da API Open-Meteo
│   │   ├── MarineWeatherProcessService.ts # Processamento e salvamento
│   │   └── MarineWeatherQueryService.ts  # Consultas ao banco
│   └── index.ts                         # Entry point
├── examples/
│   ├── publishMessage.ts                # Publicar mensagens
│   ├── queryData.ts                     # Consultar dados
│   └── backendIntegration.ts            # Integração com backend
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── README.md
├── INTEGRATION.md                       # Guia de integração
└── nodemon.json
```

## 🎯 Funcionalidades Implementadas

### 1. ✅ Recepção de Mensagens via RabbitMQ
- Exchange: `marine_weather` (fanout)
- Queue: `marine_weather_queue`
- Validação de payload com Zod
- ACK/NACK automático

### 2. ✅ Consulta à API Marine Weather
- URL: `https://marine-api.open-meteo.com/v1/marine`
- 13 condições climáticas marítimas
- Tratamento de erros robusto

### 3. ✅ Armazenamento no MongoDB
- Modelo compatível com `SensorDataModel`
- GeoJSON para localização
- Índices otimizados (2dsphere, idAsset, date)
- Upsert automático (evita duplicatas)

### 4. ✅ Estrutura de Dados

```typescript
{
  id: string;                    // ID único
  _idAsset: ObjectId;            // Referência à máquina
  idAsset: string;               // ID string da embarcação
  date: Date;                    // Data dos dados
  dateServer: Date;              // Data de processamento
  location: {
    type: 'Point';
    coordinates: [lon, lat];     // GeoJSON
  };
  data: {                        // ✅ Resposta completa da API
    latitude: number;
    longitude: number;
    hourly: {
      time: string[];
      wave_height: number[];
      wave_direction: number[];
      // ... 11 outras condições
    }
  };
  info: {                        // Metadados
    apiSource: string;
    requestedDate: string;
    processedAt: Date;
  };
  extra: {                       // ✅ Tipo de dado
    dataType: 'marine_weather_conditions';
    source: 'open-meteo';
    conditions: string[];        // Lista de condições
    timezone: string;
    elevation: number;
  };
}
```

### 5. ✅ Serviços de Consulta
- `findByAssetAsync()` - Por ID do ativo
- `findByLocationAsync()` - Busca geoespacial
- `findLatestByAssetAsync()` - Último registro
- `findByDateAsync()` - Data específica
- `countByAssetAsync()` - Contador

## 📨 Formato da Mensagem

```json
{
  "idAsset": "VESSEL123",
  "_idAsset": "507f1f77bcf86cd799439011",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "date": "2025-12-09",
  "timezone": "America/Sao_Paulo" //TODO
}
```

## 🚀 Como Usar

### 1. Instalação

```bash
cd iotlog-marine-weather
yarn install
cp .env.example .env
# Editar .env com suas configurações
```

### 2. Desenvolvimento

```bash
yarn dev
```

### 3. Produção

```bash
yarn build
yarn start
```

### 4. Docker

```bash
docker build -t iotlog-marine-weather .
docker run -d --name marine-weather \
  -e MONGO_URI=mongodb://host.docker.internal:27017 \
  -e MESSAGE_QUEUE_HOST=host.docker.internal \
  iotlog-marine-weather
```

## 🔌 Integração com IOTLOG

### Publicar do iotlog-backend

```typescript
import amqp from 'amqplib';

const connection = await amqp.connect(rabbitUrl);
const channel = await connection.createChannel();
await channel.assertExchange('marine_weather', 'fanout', { durable: true });

channel.publish('marine_weather', '', Buffer.from(JSON.stringify({
  idAsset: machine.id,
  _idAsset: machine._id.toString(),
  latitude: position.lat,
  longitude: position.lon,
  date: new Date().toISOString(),
})), { persistent: true });
```

### Consultar Dados

```typescript
// No iotlog-backend
import mongoose from 'mongoose';

const MarineWeatherModel = mongoose.model('marineWeatherData');

const history = await MarineWeatherModel.find({
  idAsset: 'VESSEL-001',
  date: { 
    $gte: startDate, 
    $lte: endDate 
  }
}).sort({ date: -1 });
```

### Criar Endpoint no Backend

```typescript
// routes/marine-weather-router.ts
router.get('/history/:idAsset', async (req, res) => {
  const data = await MarineWeatherModel.find({ 
    idAsset: req.params.idAsset 
  }).sort({ date: -1 }).limit(100);
  
  res.json(data);
});
```

### Exibir no Frontend

```jsx
// React Component
const [weather, setWeather] = useState(null);

useEffect(() => {
  Fetch.get(`/marine-weather/history/${idAsset}`)
    .then(res => setWeather(res.data));
}, [idAsset]);

return (
  <div>
    <h3>Marine Weather</h3>
    <p>Wave Height: {weather?.data.hourly.wave_height[0]}m</p>
    <p>Wind Wave: {weather?.data.hourly.wind_wave_height[0]}m</p>
  </div>
);
```

## 🌊 Condições Climáticas Coletadas

1. **wave_height** - Altura total das ondas
2. **wave_direction** - Direção das ondas
3. **wave_period** - Período das ondas
4. **wind_wave_height** - Altura das ondas de vento
5. **wind_wave_direction** - Direção das ondas de vento
6. **wind_wave_period** - Período das ondas de vento
7. **wind_wave_peak_period** - Período de pico das ondas de vento
8. **swell_wave_height** - Altura do swell
9. **swell_wave_direction** - Direção do swell
10. **swell_wave_period** - Período do swell
11. **swell_wave_peak_period** - Período de pico do swell
12. **ocean_current_velocity** - Velocidade da corrente oceânica (kn)
13. **ocean_current_direction** - Direção da corrente oceânica

## 📚 Arquivos de Exemplo

- **`examples/publishMessage.ts`** - Como publicar mensagens
- **`examples/queryData.ts`** - Como consultar dados do banco
- **`examples/backendIntegration.ts`** - Integração completa com backend

## 🎓 Uso Avançado

### Agendar Coleta Diária

```typescript
import cron from 'node-cron';

cron.schedule('0 6 * * *', async () => {
  // Buscar todas embarcações ativas
  const vessels = await MachineModel.find({ type: 'vessel', isActive: true });
  
  for (const vessel of vessels) {
    const lastPos = await getLastPosition(vessel.id);
    
    // Publicar request para próximos 7 dias
    for (let i = 0; i < 7; i++) {
      await publishWeatherRequest({
        idAsset: vessel.id,
        latitude: lastPos.lat,
        longitude: lastPos.lon,
        date: moment().add(i, 'days').format('YYYY-MM-DD'),
      });
    }
  }
});
```

### Integrar com Rotas de Viagem

```typescript
// Quando criar/atualizar viagem, solicitar clima para toda rota
async function onTravelCreated(travel) {
  const points = travel.route.coordinates;
  
  // Solicitar clima para pontos da rota
  for (const [lon, lat] of points.filter((_, i) => i % 10 === 0)) {
    await publishWeatherRequest({
      idAsset: travel.idMachine,
      latitude: lat,
      longitude: lon,
      date: travel.date,
    });
  }
}
```

## ✅ Checklist de Deploy

- [x] MongoDB configurado e rodando
- [x] RabbitMQ configurado e rodando
- [x] Variáveis de ambiente configuradas
- [x] Dependências instaladas (`yarn install`)
- [x] Build realizado (`yarn build`)
- [x] Indices do MongoDB criados (automático no primeiro run)
- [x] Exchange e queue do RabbitMQ criados (automático)

## 📊 Monitoramento

### Logs
```bash
# Logs em tempo real
docker logs -f iotlog-marine-weather

# Logs locais
yarn dev
```

### MongoDB
```bash
mongosh mongodb://localhost:27017/marine_weather

# Verificar dados
db.marineWeatherData.find().count()
db.marineWeatherData.find().limit(5).pretty()
```

### RabbitMQ
```
http://localhost:15672
User: guest
Password: guest

# Verificar:
- Exchange: marine_weather
- Queue: marine_weather_queue
- Messages: Pending/Ready
```

## 🐛 Troubleshooting

### Mensagens não sendo processadas
1. Verificar se RabbitMQ está rodando
2. Verificar logs do serviço
3. Verificar exchange e queue existem
4. Testar publicar mensagem manualmente

### Dados não sendo salvos
1. Verificar conexão com MongoDB
2. Verificar logs de erro
3. Testar consulta manual no MongoDB
4. Verificar formato do payload

### API retornando erro
1. Verificar conexão com internet
2. Testar API diretamente via curl
3. Verificar se coordenadas são válidas
4. Verificar se data está no formato correto

---

## 🎉 Pronto para Uso!

O microserviço está completo e pronto para:
- ✅ Receber mensagens via RabbitMQ
- ✅ Consultar API Open-Meteo
- ✅ Salvar dados no MongoDB (formato SensorData)
- ✅ Ser consultado pelo backend
- ✅ Integrar com frontend
- ✅ Deployment em produção

**Desenvolvido para o projeto IOTLOG** 🚀🌊⛵
