# ขั้น 2 ออกแบบระบบ Mini Connecta

เอกสารชุดนี้เป็นแบบสำหรับ Release 1 ใช้ต่อกับ [แผนงาน](../plan.md), [PBI](../connecta-release-1-pbi.th.md) และ [ต้นแบบ UI](../../demo%20ui/README.md)

## อ่านและใช้เอกสาร

| เอกสาร | ใช้ตอบคำถาม |
| --- | --- |
| [Backend และ API](backend-api.md) | UI เรียกอะไร รับข้อมูลรูปแบบไหน ตรวจสิทธิ์ตรงไหน และใช้ Colyseus กับ LiveKit อย่างไร |
| [Database](database.md) | ใครเป็นเจ้าของข้อมูล ตารางและ constraint หน้าตาอย่างไร และจะ migrate หรือกู้ข้อมูลอย่างไร |
| [Deployment](deployment.md) | Local กับ VM ใช้ Compose และ config อย่างไร เปิดพอร์ตไหน และ deploy หรือ rollback ลำดับใด |
| [Observability](observability.md) | วัดอะไรที่บริการไหน เขียน SLO อย่างไร และใช้หลักฐานอะไรตัดสินขนาด playtest |

## Tech stack ที่ใช้ในแบบนี้

Mini Connecta ใช้ **NestJS + Prisma + OpenAPI** ตามสแตกแอปของ Connecta V2 ใช้ Better Auth สำหรับ Release 1 และ deploy บน VM on-premises ของคณะ ดู [แผน V2](../../../Project-StudyRoom3d/docs/v2-plan.md) และ [บันทึกส่วนต่าง](../v2-stack-differences.md)

| ส่วน | Stack | เจ้าของงาน |
| --- | --- | --- |
| Web | Next.js App Router, React, Tailwind CSS, R3F | UI, scene, local input, OpenAPI client (`openapi-typescript` + `openapi-fetch`) และ SDK clients |
| API | NestJS (Express), `@nestjs/swagger`, Better Auth + Google OAuth, `@nestjs/throttler` | Session, ตัวละคร, ออกตั๋วเข้าห้อง และรับผลวัดจาก browser |
| Game | Colyseus, Zod สำหรับข้อความ realtime และ shared movement/map rules | ห้องเดียว ผู้เล่น ความจุ การเดินและ reconnect |
| Voice | LiveKit self-hosted, JS SDK และ Server SDK | WebRTC audio สำหรับห้องเดียว Game ออก token ตามสิทธิ์ |
| Data | PostgreSQL 17, Prisma 7 และ Prisma Migrate | User, Google account, session และ avatar |
| Runtime | Node.js LTS, TypeScript, pnpm, Caddy, Docker Compose | Local และ Linux VM on-premises ของคณะ |
| Monitoring | Prometheus, Grafana, Alertmanager, Alloy, Loki และ `@nestjs/terminus` สำหรับ readiness | Metrics, logs และ alerts |
| Verification | Vitest, Playwright, k6, Colyseus bots, LiveKit CLI และ GitHub Actions | Tests, local load test และ Docker image bundle ตาม commit |

ดูฐานระบบที่นำมาประกอบการออกแบบได้จาก [สถาปัตยกรรม V1](../../../Project-StudyRoom3d/README.md) และ [Compose ของ V1](../../../Project-StudyRoom3d/infra/compose/README.md)

## เส้นทางของข้อมูล

~~~mermaid
flowchart LR
    Browser["Browser"]
    Google["Google OAuth"]
    Edge["Caddy HTTPS และ WSS"]
    Web["Next.js web"]
    API["NestJS API และ Better Auth"]
    Game["Colyseus game"]
    Voice["LiveKit"]
    DB[("PostgreSQL")]
    Obs["Prometheus, Alloy และ Grafana"]
    Browser <-->|"Sign in redirect"| Google
    API <-->|"OAuth token exchange"| Google
    Browser <-->|"HTTPS และ WSS"| Edge
    Edge -->|"Pages และ assets"| Web
    Edge -->|"/api/*"| API
    Edge <-->|"game host และ WebSocket"| Game
    Edge <-->|"rtc host และ signaling"| Voice
    Browser <-->|"WebRTC media"| Voice
    API -->|"Prisma: accounts, sessions และ avatars"| DB
    API -->|"Internal room lookup"| Game
    Game -->|"Room Service"| Voice
    API -->|"Metrics และ logs"| Obs
    Game -->|"Metrics และ logs"| Obs
    Voice -->|"Metrics และ logs"| Obs
~~~

ใช้หลัก **Model the Domain** ให้ Colyseus ถือ state ของผู้เล่นและความจุเพียงจุดเดียว ส่วน PostgreSQL ถือข้อมูลที่ต้องอยู่หลัง restart ใช้ **Boundary Discipline** ให้ API และ Game ตรวจข้อมูลที่รับเข้า และใช้ **Make Operations Idempotent** ให้เซฟ avatar ซ้ำหรือ cleanup ซ้ำได้

### เส้นทางตั้งแต่เข้าระบบถึงเดินในห้อง

1. Better Auth ทำ Google OAuth callback และสร้าง session cookie ของเว็บ
2. Web เรียก `GET /api/me` ถ้า `avatar: null` ให้ไปสร้างตัวละคร ถ้ามี avatar แล้วให้ไป Discover
3. Discover แสดง Common room หนึ่งใบจาก config และ Open rooms เป็นข้อความว่าง เมื่อกด Walk in ให้ขอตั๋วเข้าห้อง
4. Browser ส่งตั๋วให้ Colyseus จากนั้นรอ initial state ที่มีตัวเองและ scene พร้อม ฝั่ง Game คุมความจุและตำแหน่ง
5. Browser ขอสิทธิ์เสียงผ่าน connection ของ Game หลังเข้าห้องแล้ว LiveKit ส่ง audio ส่วน Web ลดเสียงตามระยะจากตำแหน่งใน Colyseus

## ขอบเขตการเริ่มงาน

- หนึ่ง Study Room และหนึ่ง Cosy Library map ใช้ logical ID `study-room` กับ `cosy-library` ตั้งความจุเริ่มต้น 20 คนก่อนปรับตามผล local รวมถึงผู้ที่อยู่ในช่วง reconnect
- เริ่มด้วย instance เดียวต่อบริการและ room state ใน memory ตัวละครอยู่ใน DB ใช้ browser cache สำหรับ static asset ตามนโยบายใน [Deployment](deployment.md) รอบนี้ยังไม่ใช้ Redis
- ค่าร่างที่ทีมจะปรับจากผลทดสอบคือความจุจริง, budget ของ VM และความจำเป็นของ TURN/TLS ในเครือข่ายที่จะใช้ ตำแหน่งผู้เล่นและเสียงชั่วคราวหายได้เมื่อบริการที่ถือ state restart
- ขั้น 3 ใช้ response/error examples ใน [Backend](backend-api.md) ทำ OpenAPI snapshot และ typed mock ขั้น 4 ให้ NestJS ออก OpenAPI จาก routes จริงแล้วตรวจให้ตรงกับ contract
