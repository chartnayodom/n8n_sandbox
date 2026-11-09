# n8n พร้อม workflow ของโปรเจกต์ (Jenkins import จาก /home/node/workflows ทุกครั้งที่ deploy)
# pin เวอร์ชันให้ตรงกับที่ใช้พัฒนาและทดสอบ workflow (package.json: n8n 2.8.4) เปลี่ยนได้ด้วย --build-arg N8N_VERSION=...
ARG N8N_VERSION=2.8.4
FROM docker.n8n.io/n8nio/n8n:${N8N_VERSION}

USER root
RUN mkdir -p /home/node/workflows && chown -R node:node /home/node/workflows

# ใส่เฉพาะ workflow ที่ใช้งานจริง ไฟล์อื่นในโฟลเดอร์ workflows/ เป็นเวอร์ชันเก่าที่ไม่ควร import เข้า production
# ทั้งสองไฟล์มี id คงที่ import ซ้ำทุก deploy จะอัปเดต workflow เดิม ไม่สร้างซ้ำ
COPY --chown=node:node workflows/AutoMailOutbound.json workflows/R3pXov64UiK0AkDL.json /home/node/workflows/

USER node
