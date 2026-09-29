FROM node:20-alpine

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm install --production

# คัดลอกโค้ดระบบ
COPY . .

# กำหนด Region Asia-Southeast1 (Collocation)
ENV CLOUD_REGION=asia-southeast1
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# รัน Master Orchestrator (WebServer + 14 Departments + Telegram Baron Bot)
CMD ["node", "workforce-orchestrator.js"]
