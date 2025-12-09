# Testes - IoTLog Marine Weather Service

Este documento descreve como executar os testes de integração para o serviço de dados meteorológicos marinhos.

## 📋 Visão Geral

Os testes validam:
- ✅ Processamento de mensagens recebidas
- ✅ Salvamento correto no MongoDB
- ✅ Estrutura dos dados salvos
- ✅ Atualização de dados existentes (upsert)

## 🚀 Executando os Testes

### Testes Unitários/Integração (MongoDB em Memória)

Os testes usam `mongodb-memory-server` para simular o MongoDB sem necessidade de instância real:

```bash
# Executar todos os testes
npm test

# Executar com watch mode (reexecuta ao salvar)
npm run test:watch

# Executar com relatório de cobertura
npm run test:coverage
```

### Teste Manual com RabbitMQ Real

Para testar o fluxo completo com RabbitMQ real:

#### 1. Certifique-se que os serviços estão rodando:

```bash
# MongoDB
docker-compose up -d mongodb

# RabbitMQ
docker-compose up -d rabbitmq
```

#### 2. Inicie o serviço:

```bash
npm run dev
```

#### 3. Publique uma mensagem de teste:

```bash
npx tsx examples/publishMessage.ts
```

#### 4. Verifique os dados no MongoDB:

```bash
npx tsx examples/queryData.ts
```

## 🧪 Estrutura dos Testes

### `__tests__/integration.test.ts`

Contém 3 testes principais:

1. **Teste de Processamento e Salvamento**
   - Simula mensagem RabbitMQ
   - Valida salvamento no banco
   - Verifica campos obrigatórios

2. **Teste de Estrutura de Dados**
   - Valida estrutura completa
   - Verifica campos de data/hora
   - Confirma dados da API (hourly)

3. **Teste de Atualização (Upsert)**
   - Envia mensagem duplicada
   - Confirma que não duplica documentos
   - Valida atualização do timestamp

## 📊 Exemplo de Payload de Teste

```json
{
  "idAsset": "VESSEL-001",
  "_idAsset": "507f1f77bcf86cd799439011",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "date": "2024-12-01",
  "timezone": "America/Sao_Paulo"
}
```

## ✅ Dados Validados

Os testes verificam que os dados salvos contêm:

### Campos Obrigatórios
- `idAsset`: ID do ativo (embarcação)
- `_idAsset`: ObjectId do ativo
- `date`: Data da medição
- `dateServer`: Data do servidor
- `location`: GeoJSON Point com coordenadas
- `data`: Resposta completa da API
- `extra`: Metadados

### Estrutura do campo `data`
```typescript
{
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  hourly: {
    time: string[];
    wave_height: number[];
    wave_direction: number[];
    wave_period: number[];
    wind_wave_height: number[];
    // ... outras condições
  }
}
```

### Estrutura do campo `extra`
```typescript
{
  dataType: 'marine_weather_conditions';
  source: 'open-meteo';
  conditions: string[];
  timezone: string;
  elevation: number;
}
```

## 🔍 Verificando Dados no MongoDB

### Usando MongoDB Compass
1. Conecte em `mongodb://localhost:27017`
2. Database: `marine_weather`
3. Collection: `marineWeatherData`

### Usando CLI
```bash
# Conectar ao MongoDB
mongosh mongodb://localhost:27017/marine_weather

# Listar documentos
db.marineWeatherData.find().pretty()

# Contar documentos
db.marineWeatherData.countDocuments()

# Buscar por embarcação específica
db.marineWeatherData.find({ idAsset: "VESSEL-001" }).pretty()

# Buscar por data
db.marineWeatherData.find({ 
  date: { $gte: ISODate("2024-12-01"), $lt: ISODate("2024-12-02") }
}).pretty()
```

## 🐛 Troubleshooting

### Erro: "Cannot connect to MongoDB"
- Verifique se o MongoDB está rodando
- Confirme a URL no `.env`

### Erro: "Cannot connect to RabbitMQ"
- Verifique se o RabbitMQ está rodando
- Confirme as credenciais no `.env`

### Testes falham ao chamar API
- Verifique conexão com internet
- API Open-Meteo pode estar temporariamente indisponível
- Testes usam chamadas reais à API (não mockadas)

## 📝 Notas

- Os testes de integração fazem chamadas **REAIS** à API Open-Meteo
- MongoDB em memória é usado para isolamento dos testes
- Cada teste limpa os dados antes de executar
- Timeout padrão é 30 segundos (API externa pode demorar)
