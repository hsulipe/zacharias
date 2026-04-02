FROM node:20-alpine

# Install system deps for OCR
RUN apk add --no-cache \
  tesseract-ocr \
  tesseract-ocr-data-por \
  tesseract-ocr-data-eng \
  poppler-utils \
  ghostscript

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx tsx migrations/run-migrations.ts && npm run dev"]
