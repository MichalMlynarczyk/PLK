FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV DATA_DIR=/app/data
EXPOSE 5173

CMD ["npm", "start"]
