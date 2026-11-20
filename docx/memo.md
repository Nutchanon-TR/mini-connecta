##ไฟล์นี้ใช้เก็บ memo เท่านั้น ai ไม่ต้องสนใจไฟล์นี้ อิอิ
git commit -m "checkpoint x.x"
git tag -a a.b.c -m "checkpoint x.x"
a -> release
b -> plan
c -> ครั้งที่เท่าไหร่
git push --follow-tags

เครื่องมือที่แนะนำเพิ่ม
1. @nestjs/swagger + openapi-typescript + openapi-fetch ใช้ NestJS สร้าง OpenAPI แล้ว generate types ให้ client ฝั่ง Next.js ใช้ schema เดียวกันกับ mock และตรวจใน CI ว่า types ตรงกับ contract ผมแนะนำชุดนี้เป็นอันดับแรก เพราะเป็นส่วนที่ใช้แทน Hono RPC โดยตรง NestJS OpenAPI · openapi-fetch
2. @nestjs/terminus ใช้ทำ readiness ให้รู้ว่า API พร้อมรับงานและต่อ PostgreSQL ได้ เหมาะกับ Compose และ smoke test ตอนเปลี่ยน release NestJS health checks
3. @nestjs/throttler ใช้จำกัดการขอตั๋ว Join และการส่ง telemetry เริ่มด้วย storage ในหน่วยความจำสำหรับ API instance เดียว แล้วใช้ Redis เมื่อมีหลาย instance ที่ต้องแชร์ตัวนับ NestJS rate limiting