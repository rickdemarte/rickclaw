# Use debian-based slim image
FROM node:20-bookworm-slim

WORKDIR /app

# Install Python and dependencies required by Python skills
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install pypdf PyPDF2 boto3 requests urllib3 --break-system-packages

# Copy package descriptors 
COPY package*.json ./

# Install dependencies (including devDependencies for tsc build)
RUN npm install

# Copy source code and config
COPY tsconfig.json vitest.config.ts ./
COPY src/ ./src/
COPY tests/ ./tests/
COPY public/ ./public/
COPY data/smalltalk-dictionary.json ./data/smalltalk-dictionary.json

# Build typescript
RUN npm run build

# Roda testes — se falhar, o build da imagem para aqui
RUN npm test

ENV PORT=3128

# Expose Web Chat API
# Default internal port. Runtime may override it with PORT.
EXPOSE 3128

# Start production server
CMD ["npm", "start"]
