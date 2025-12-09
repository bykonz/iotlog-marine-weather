FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package.json yarn.lock ./

# Instalar dependências
RUN yarn install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build TypeScript
RUN yarn build

# Expor porta (se necessário para health check)
EXPOSE 3015

# Comando para executar
CMD ["node", "build/src/index.js"]
