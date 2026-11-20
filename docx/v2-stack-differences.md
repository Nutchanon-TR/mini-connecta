# บันทึกส่วนต่าง Mini Connecta กับ Connecta V2

อัปเดต 20 พฤศจิกายน 2026 · ใช้คู่กับ [แผน Release 1](plan.md) และ [แบบระบบ](02-system-design/README.md)

## ข้อสรุปร่วมของทั้งสองโปรเจกต์

สแตกแอปอิง Connecta V2 ได้แก่ NestJS, Prisma, OpenAPI, Next.js/R3F, Colyseus และ LiveKit self-hosted ส่วน deployment ใช้ **VM on-premises ของคณะ** ตามทิศทางล่าสุดที่ owner ยืนยัน แบบ AWS ในเอกสาร V2 เดิมและ deployment ของ V1 เป็นข้อมูลอ้างอิงเดิม ส่วนนี้เป็นการตัดสินใจร่วมของทั้งสองโปรเจกต์ [แผนสแตก V2](../../Project-StudyRoom3d/docs/v2-plan.md) · [แบบ infra V2 เดิม](../../Project-StudyRoom3d/docs/v2/features/15-business-infra.md)

| รายการในแผนก่อนหน้า | วิธีที่ใช้บนโครงสร้างพื้นฐานคณะ |
| --- | --- |
| EC2 และ infrastructure ของ AWS | Linux VM ที่คณะจัดให้ ใช้ Docker Compose และ Caddy |
| RDS | PostgreSQL บน Compose private network ของ VM คณะ พร้อม persistent volume และ backup แยกจาก VM |
| ECR ในแบบ V2 เดิม และ GHCR ในร่าง Mini เดิม | GitHub Actions build และ export image archive ตาม commit ให้ owner ส่งและใช้ `docker load` บน VM คณะ หากคณะมี private registry ให้ใช้ registry ของคณะได้ |
| Route 53 และ SSM | ใช้ DNS, TLS, ช่องทางผู้ดูแล และที่เก็บ secrets ที่คณะอนุญาต |

รายละเอียด ingress, พอร์ต LiveKit, การส่ง image และ rollback อยู่ใน [Deployment](02-system-design/deployment.md)

## รายการที่ Mini เพิ่มหรือเลือกเฉพาะ Release 1

| เรื่อง | ในแผน V2 | Mini Connecta Release 1 | เหตุผลและจังหวะทบทวน |
| --- | --- | --- | --- |
| Auth | Google, Discord และอีเมลโค้ด พร้อม session cookie | Better Auth + Prisma adapter ทำ Google Sign-in และ DB-backed session | Better Auth เป็นไลบรารีที่ Mini เลือกเพิ่ม V2 ระบุช่องทางล็อกอินไว้แล้ว ทบทวน scope และ account linking เมื่อเพิ่ม provider |
| API contract | NestJS และ OpenAPI-generated client | `@nestjs/swagger` สร้าง spec, `openapi-typescript` สร้าง types และ `openapi-fetch` เรียก REST API | เลือกเครื่องมือสำหรับแนวทาง V2 ใช้ contract เดียวกับ mock และตรวจความตรงกันใน CI |
| Health และ rate limiting | แนวทาง health/monitoring และ Redis สำหรับ rate limit ที่แชร์ | `@nestjs/terminus` สำหรับ API readiness และ `@nestjs/throttler` สำหรับ Join/telemetry โดยเก็บตัวนับใน memory | ให้ Release 1 ทำงานใน API instance เดียว เปลี่ยนไปแชร์ตัวนับเมื่อมีหลาย instance |
| บัญชีและห้อง | บัญชีมี @handle, วันเกิด และหลายห้อง | หนึ่ง avatar ต่อบัญชี และ Common Study Room ห้องเดียว | ครอบคลุม flow ของ Release 1 ขยายตาม PBI รอบถัดไป |
| Realtime และ jobs | Colyseus พร้อม NestJS gateway, Redis และ BullMQ ตามงาน V2 | ใช้ Colyseus ถือ movement และ presence ในห้อง พร้อม LiveKit ส่งเสียง | เพิ่ม gateway, Redis และ BullMQ เมื่อเริ่มงาน DM, presence ข้าม instance หรือ background jobs |
| Monitoring และ load test | Prometheus, Grafana, Loki, Alloy และ Alertmanager โดยแบบ V2 มีเครื่อง monitoring แยก | เริ่ม Compose profile บน VM คณะเครื่องเดียว เพิ่มการวัด Join/Voice ตามสภาพ UI และใช้ k6, Colyseus bots, LiveKit CLI ใน local | ลดจำนวน VM ที่ต้องใช้ช่วง playtest แยก monitoring เมื่อทรัพยากรหรือแนวทางคณะต้องการ |

[Spec บัญชี V2](../../Project-StudyRoom3d/docs/v2/features/02-accounts.md) · [Backend/API](02-system-design/backend-api.md) · [Observability](02-system-design/observability.md)

## สิ่งที่เปลี่ยนจากร่าง Mini เดิม

Hono และ Hono RPC เปลี่ยนเป็น NestJS และ OpenAPI typed client ส่วน Drizzle เปลี่ยนเป็น Prisma 7 และ Prisma Migrate ใช้ Better Auth ต่อผ่าน Express handler ของ NestJS และ Prisma adapter Workspace ที่เตรียมในข้อ 3.1 รองรับ package layout นี้แล้ว รายละเอียด API และ schema อยู่ใน [Backend/API](02-system-design/backend-api.md) และ [Database](02-system-design/database.md)
