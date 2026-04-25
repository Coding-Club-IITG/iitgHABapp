FROM node:20-slim

WORKDIR /app

# Install libfaketime
RUN apt-get update && \
    apt-get install -y --no-install-recommends libfaketime tzdata && \
    rm -rf /var/lib/apt/lists/*

# Install pm2
RUN npm install -g pm2

# Install deps
COPY package.json package-lock.json ./
RUN npm install
COPY v1/package.json v1/package-lock.json ./v1/
RUN cd v1 && npm install

# Copy all source code
ARG CACHEBUST=1
COPY . .

EXPOSE 3000

# Run start script
COPY test/start.sh .
RUN sed -i -e 's/\r$//' start.sh && \
    chmod +x start.sh

CMD ["./start.sh"]
