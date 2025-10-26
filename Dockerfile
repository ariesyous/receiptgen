FROM node:18-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=3000
ENV RECEIPT_OUTPUT_DIR=/app/data/receipts

EXPOSE 3000
VOLUME ["/app/data/receipts"]

CMD ["npm", "start"]
