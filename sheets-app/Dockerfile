# เว็บ AutoMail Insurance: build หน้าเว็บ (Vite) แล้วให้ server (Express) เสิร์ฟทั้งหน้าเว็บและ /api ใน container เดียว
# ค่าลับ (SPREADSHEET_ID, Service Account, IMAP) ส่งตอนรันผ่าน env_file ไม่ใส่ไว้ใน image

# ---- 1. build หน้าเว็บ ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. server + หน้าเว็บที่ build แล้ว ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/*.js ./
COPY --from=client /app/client/dist ./public

USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/status" > /dev/null || exit 1
CMD ["node", "index.js"]
