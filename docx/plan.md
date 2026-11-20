# Mini Connecta — แผน Release 1

สถานะ **ขั้น 3.4 เสร็จแล้ว พร้อมเริ่มขั้น 3.5** · อัปเดต 20 พฤศจิกายน 2026

เป้าหมายคือทำ Study Room 3D รุ่นเล็กให้คนสองคนเปิดเว็บจากคนละเครื่อง เข้าห้องเดียวกัน เห็นกันเดิน และคุยตามระยะได้ ใช้โปรเจกต์นี้ฝึกทำระบบครบตั้งแต่ UI ถึงการ deploy บน VM และเก็บหลักฐานว่าระบบทำงานอย่างไรเมื่อมีโหลดหรือบริการล่ม

**เส้นทางผู้ใช้** — Sign in → สร้างตัวละครครั้งแรก → Discover → Join Study Room → เดินและคุย → Leave กลับ Discover

- แถบนำทางมี Discover เป็นเมนูเดียว หน้า Discover แสดงการ์ด Study Room หนึ่งใบใน Common rooms และข้อความ “No open rooms yet.” ใน Open rooms ผู้ใช้เก่าข้ามหน้าสร้างตัวละครได้
- ข้อเสนอสำหรับรอบนี้คือ Google Sign-in ช่องทางเดียว ตัวละครหนึ่งตัวต่อบัญชี และห้องจำกัดจำนวนคนตามผลทดสอบ เป้า playtest เริ่มต้น 15–20 คน
- งานต่อยอดหลัง Release 1 ได้แก่ Guest, ลิงก์เข้าห้องโดยตรง, วันเกิดและ @handle, Bubbles, สร้างห้องและเปลี่ยนแผนที่, Friends, DM, เกม, ระบบชำระเงิน และ screen share
- ทำ integration, E2E, load test และซ้อมกู้ระบบใน local หลัง deploy ให้ทำ smoke test บน VM เพื่อเช็กโดเมน, TLS, OAuth และเสียงข้ามเครือข่ายจริง

## Tech stack สำหรับ Release 1

ยึดสแตกแอปของ Connecta V2 และใช้ VM on-premises ของคณะเป็นเป้าหมาย deploy ตามที่ owner ยืนยัน ดูรายการตัดสินใจและส่วนต่างที่ [v2-stack-differences.md](v2-stack-differences.md)

| ส่วน | เทคโนโลยี | ใช้ทำอะไร |
| --- | --- | --- |
| Workspace | Node.js LTS, TypeScript, pnpm workspaces | แยก `apps/web`, `apps/api`, `apps/game`, `packages/shared` และ `packages/db` |
| Frontend | Next.js App Router, React, Tailwind CSS | Sign in, Character, Discover, Room HUD และ UI สำหรับสถานะการเชื่อมต่อ |
| 3D | Three.js, React Three Fiber, assets จาก Study Room 3D | แสดงแผนที่ ตัวละคร และการเคลื่อนไหว |
| REST API | NestJS (Express), OpenAPI, `@nestjs/swagger`, `openapi-typescript`, `openapi-fetch` | อ่าน session และตัวละคร บันทึกตัวละคร และออกตั๋วเข้าห้อง |
| Auth | Better Auth + Prisma adapter, Google OAuth, DB-backed session | ลงชื่อเข้าใช้และออกจากระบบ ใช้ session cookie แบบ HttpOnly พร้อม Secure บน HTTPS |
| Database | PostgreSQL 17, Prisma 7 และ Prisma Migrate | เก็บบัญชี, session, ตัวละคร และจัดการ schema migrations |
| Multiplayer | Colyseus ผ่าน WebSocket | ตรวจตั๋วเข้าห้อง คุมความจุและตำแหน่งผู้เล่น ส่งสถานะให้ browser |
| Voice | LiveKit self-hosted, LiveKit JS SDK และ Server SDK | ส่งเสียงผ่าน WebRTC ให้ game server ออก token หลังเข้าเกมสำเร็จ |
| Reverse proxy และ deploy | Caddy, Docker Compose, Linux VM ของคณะ | HTTPS/WSS, ส่ง `/api` ไป API, เปิด media ports และรันบริการจาก image |
| Observability | Prometheus, Grafana, Alertmanager, Loki, Alloy และ `@nestjs/terminus` สำหรับ readiness | เก็บ metrics และ logs ดู dashboard และแจ้งเตือน |
| Quality และ CI | Prettier, ESLint, TypeScript, Vitest, Playwright, k6, Colyseus bots, LiveKit CLI, GitHub Actions และ Docker image bundle | ตรวจโค้ด ทดสอบผู้ใช้และโหลด และจัด release ตาม commit SHA |

ใช้ `@nestjs/throttler` กับ endpoint ที่ออกตั๋ว Join และรับ telemetry ดู [แบบระบบขั้น 2](02-system-design/README.md) สำหรับ package ownership และเส้นทางของข้อมูล

เริ่มจาก **VM ของคณะหนึ่งเครื่องและหนึ่ง instance ต่อบริการ** ใช้ PostgreSQL volume เก็บข้อมูลและเก็บ backup นอก VM บน storage ที่คณะอนุญาต ให้ browser cache โมเดลและ texture ที่มีชื่อเวอร์ชันตาม content hash ใช้ `Cache-Control: no-store` กับ session, ตัวละครส่วนตัว และตั๋วเข้าห้อง เริ่มโดยยังไม่มี Redis เพิ่มเมื่อจะรันหลาย instance หรือผลวัดชี้ว่าต้องใช้ cache ร่วมกัน

## 1. ร่าง UI และเส้นทางผู้ใช้

[เปิดไฟล์ต้นแบบ](../demo%20ui/index.html) · [วิธีรันและลองสถานะต่าง ๆ](../demo%20ui/README.md) · [Release 1 PBI](connecta-release-1-pbi.th.md)

- [x] **1.1** เปิด demo ของ Study Room 3D ดู layout และเลือกส่วนที่จะใช้เป็นต้นแบบ ทำรายการหน้าที่ต้องร่าง ได้แก่ Sign in, Create Character, Discover และ Study Room
- [x] **1.2** ร่าง flow ผู้ใช้ใหม่และผู้ใช้เดิม ผู้ใช้ใหม่ต้องบันทึกตัวละครก่อน Join ผู้ใช้เดิมเข้า Discover หลัง sign-in และกลับมาเห็นตัวละครเดิมหลัง reload
- [x] **1.3** ร่าง Discover ตามต้นแบบเดิม มี Study Room หนึ่งการ์ดใน Common rooms และ Open rooms เป็นสถานะว่าง ร่าง Room HUD เท่าที่จำเป็น เช่น กำลังเชื่อมต่อ, mic on/off, reconnect และ Leave กำหนดให้ไมค์เริ่มปิดและห้องยังเดินได้เมื่อผู้ใช้ไม่เปิดไมค์
- [x] **1.4** ร่างสถานะผิดพลาดตามจุดที่เกิด เช่น ยกเลิก sign-in, เซฟตัวละครไม่สำเร็จ, ห้องเต็ม, หลุดจาก game server, ปฏิเสธไมค์ และเสียงต่อไม่ได้ แต่ละสถานะต้องมีทางไปต่อหรือปุ่มลองใหม่
- [x] **1.5** ทำต้นแบบกดได้ด้วย mock แล้วลองบนจอมือถือและเดสก์ท็อป ใช้ข้อความ UI ภาษาอังกฤษ

**ผ่านเมื่อ** ผู้ใช้ใหม่กดจาก Sign in ถึง Study Room แล้ว Leave กลับ Discover ได้ในต้นแบบ และรู้ว่าต้องทำอะไรเมื่อเข้าห้องหรือเปิดไมค์ไม่ได้ จากนั้นใช้หน้าจอและสถานะเหล่านี้กำหนด contract ในขั้น 2

**ผลตรวจขั้น 1** ผ่าน flow ผู้ใช้ใหม่และผู้ใช้เดิม รวมสถานะ sign-in ถูกยกเลิก เซฟล้มเหลว ห้องเต็ม การเชื่อมต่อหลุด และไมค์ใช้ไม่ได้ บน viewport 1440, 390 และ 320 px ใน Playwright

## 2. ออกแบบ backend, DB และระบบที่จะวัด

[เปิดชุดแบบระบบและแผนภาพ](02-system-design/README.md)

- [x] **2.1** ใช้ NestJS, Prisma และ OpenAPI ตาม V2 พร้อม Better Auth และวางเส้นทางระหว่าง Browser, Caddy, API, Game และ LiveKit ใน [ภาพรวม](02-system-design/README.md)
- [x] **2.2** กำหนด schema, constraints, ownership ของ state และ migration ใน [Database](02-system-design/database.md)
- [x] **2.3** ร่าง HTTP request/response/error พร้อม realtime state และข้อความที่ใช้ทำ mock ใน [Backend และ API](02-system-design/backend-api.md)
- [x] **2.4** กำหนด session, signed ticket, การจองที่นั่ง, Voice token, Leave และ Reconnect ใน [Backend และ API](02-system-design/backend-api.md#join-seat-และ-reconnect)
- [x] **2.5** กำหนด topology ของ VM คณะ, env, OAuth callback, พอร์ต, TURN/TLS, การส่ง image, backup และ rollback ใน [Deployment](02-system-design/deployment.md)
- [x] **2.6** ระบุ SLO, จุดวัด, วิธีนับ retry, dashboard และแผนทดสอบใน [Observability](02-system-design/observability.md)

**ผ่านเมื่อ** ตัวอย่าง API ครอบคลุม flow จาก UI รู้ว่าแต่ละ state อยู่ที่ไหน และกำหนดจุดวัดของแต่ละ SLO แล้ว ขั้น 3 ใช้ตัวอย่างจาก [Backend และ API](02-system-design/backend-api.md) เพื่อทำ typed mock และ UI states

## 3. ทำ frontend ให้สลับจาก mock เป็น API ได้

- [x] **3.1** ตั้ง pnpm workspace และเก็บ Git checkpoint แรกใน repo ของ Mini Connecta โดยตรวจว่า repo แม่ไม่มีไฟล์ในโฟลเดอร์นี้ถูก track
- [x] **3.2** วางหน้าใน `apps/web/src/app/` และโค้ดตาม feature ใต้ `apps/web/src/features/` ให้ route ทำหน้าที่ประกอบหน้าจอ ส่วน logic ของ auth, avatar, discover และ room อยู่ใน feature ของตัวเอง
- [x] **3.3** ทำ OpenAPI snapshot จากแบบระบบเพื่อ generate types ด้วย `openapi-typescript` และใช้ `openapi-fetch` ใน `apps/web/src/lib/api.ts` ให้แต่ละ feature เรียกผ่าน client กลางและแปลง error เป็นสถานะของ UI เก็บ schema ของ realtime ที่ใช้ร่วมกันใน `packages/shared`
- [x] **3.4** ทำ mock ให้ใช้ types จาก OpenAPI snapshot และคืน error ตาม contract เดียวกับ API จริง เช่น ไม่มี session, ไม่มี avatar และ join fail ให้สลับ mock ที่ชั้นเรียก API เพื่อให้ component ใช้ข้อมูลรูปแบบเดิม
- [ ] **3.5** เตรียมจุดเปิดและปิด Colyseus/LiveKit ใน feature ห้อง แยก lifecycle ของทั้งคู่ เมื่อ Leave ให้ cleanup connection, audio tracks และ input เมื่อ reload ให้โหลด session และ avatar ตาม flow เดิม
- [ ] **3.6** ตรวจเส้นทางผู้ใช้ใหม่ ผู้ใช้เดิม และหน้า error ด้วย mock รัน typecheck และ lint ก่อนส่งต่อ

**Workspace** ใช้ package web, api, game, shared และ db ให้รัน pnpm และ Git จากราก Mini-Connecta

**สรุปโค้ด** ตั้งแต่ข้อ 3.3 ให้อัปเดต [Architecture Summary](architecture-summary.th.md) ในงานเดียวกันเมื่อเพิ่ม ย้าย ลบไฟล์ หรือเปลี่ยนหน้าที่ของไฟล์

**ผลตรวจ 3.2** ย้ายหน้า `/login`, `/character`, `/discover` และ `/rooms/study-room` เข้า Next.js App Router แล้ว แยกโค้ดตาม feature และใช้ CSS, ภาพ และสถานะ UI จำลองจาก Demo UI รัน build และ typecheck ผ่าน ตรวจ flow ด้วย Playwright ที่ 1440, 390 และ 320 px

**ผลตรวจ 3.3** มี [OpenAPI snapshot](../apps/api/openapi.snapshot.json), generated types, HTTP client กลางและ schema realtime ตรวจ codegen, typecheck และผลแปลง response ผ่านแล้ว UI ยังใช้ flow จำลองเดิมจนถึงขั้น 3.4

**ผลตรวจ 3.4** UI ใช้ typed API client กับ mock transport เป็นค่าเริ่มต้น ตั้งค่า `NEXT_PUBLIC_API_MODE=real` เพื่อส่ง REST request ไป origin เดิม ตรวจ contract, build และ flow ผู้ใช้ที่ 1440, 390 และ 320 px ผ่าน รวม session หมดอายุและ Join retry

**ผ่านเมื่อ** UI ผ่าน flow ด้วย mock และรู้ว่าจะเปลี่ยน call ไหนไป API จริงทีละตัว จากนั้นเริ่มต่อ auth ในขั้น 4

## 4. ทำ backend และต่อระบบจริงใน local

- [ ] **4.1** ตั้ง NestJS บน Express และสร้าง Compose สำหรับ Postgres กับ LiveKit ใช้ local credentials และ health checks เขียน `.env.example` ด้วยค่าตัวอย่าง เริ่มเพิ่ม structured logs ตั้งแต่บริการแรก
- [ ] **4.2** ต่อ Better Auth กับ Google OAuth ผ่าน Node handler และ Prisma adapter ให้ Prisma Migrate ดูแล schema ทั้งแอปกับ Auth ตั้ง redirect URI ให้ตรง local URL ทดสอบ sign-in, sign-out และเข้า route ที่ต้องใช้ session หลัง sign-out
- [ ] **4.3** ทำ `GET /api/me` และ `PUT /api/me/avatar` แล้วสลับหน้า Character ไป API จริง ทดสอบเซฟซ้ำ, reload และ restart app เพื่อยืนยันว่าค่ามาจาก DB และยังมีตัวละครเดียวต่อบัญชี
- [ ] **4.4** ต่อ Discover → API ออกตั๋ว → Colyseus join ใส่แผนที่ Study Room แล้วลองสอง browser contexts ให้เห็นกันเดิน ทดสอบห้องเต็ม, ตั๋วหมดอายุ, หลุดแล้วกลับ และ Leave แล้วคนอื่นเห็นผู้เล่นออก
- [ ] **4.5** ต่อ LiveKit หลัง join ผ่าน ให้ game server ออก token เฉพาะห้องและ participant นั้น จับคู่ track กับตำแหน่งจาก Colyseus แล้วทดสอบ mute, เดินเข้า–ออกระยะ และกรณี LiveKit ล่มแต่ผู้เล่นยังเดินได้
- [ ] **4.6** ใช้ `@nestjs/swagger` ออก OpenAPI จาก NestJS แล้วเทียบกับ snapshot และ regenerate types ตั้ง `@nestjs/throttler` สำหรับ Join/telemetry เพิ่ม metrics, `@nestjs/terminus` สำหรับ readiness และ logs ตาม contract จากขั้น 2 เขียน Dockerfile สำหรับ web/API/game และลองรันทั้ง stack ผ่าน Caddy ใน local จากฐานข้อมูลว่างและจากฐานข้อมูลที่มี avatar แล้ว ให้ migration มีผู้รันเพียงจุดเดียว

**ผ่านเมื่อ** คนสองคน sign-in, เซฟตัวละคร, เข้าห้อง, เห็นกันเดิน และคุยได้บน local stack ที่รันผ่าน Compose จากนั้นค่อยเพิ่มโหลดในขั้น 5

## 5. เปิด monitoring แล้วทดสอบโหลดและการกู้ระบบ

- [ ] **5.1** เปิด observability profile ของ Compose ทำ dashboard สำหรับ API, join, voice, game loop และทรัพยากร เช็กด้วย request และการเข้าห้องจริงว่า metrics เพิ่ม และดู log ของเหตุการณ์เดียวกันได้โดยไม่เก็บ token หรือข้อมูลผู้ใช้ใน labels
- [ ] **5.2** เก็บ baseline ที่ผู้เล่นจริง 2 คน วัดเวลา Join, เสียง, movement และ FPS ทำ E2E สำหรับ flow หลักและ error ที่กำหนดไว้ ใช้ Chrome/Playwright แบบ muted สำหรับ automation และตรวจการได้ยินจริงแยกด้วยสองเครื่อง
- [ ] **5.3** ยิง API ด้วย k6, จำลองการเดินด้วย Colyseus bots และจำลองผู้ส่ง–รับเสียงด้วย `lk perf` ไล่โหลด 5, 10, 20 และ 30 คนเทียบ baseline จากนั้นเทส workload รวมที่ 20 คน ให้มีทั้งเดิน เชื่อมเสียง และทยอยเข้า–ออกห้อง
- [ ] **5.4** ซ้อม API/DB ล่ม, game restart, LiveKit ล่ม และ disk ใกล้เต็ม ตรวจว่า UI ตอบสนองอย่างไร dashboard เห็นอาการหรือไม่ และ alert ที่ตั้งไว้แจ้งและ resolve เมื่อบริการกลับมา
- [ ] **5.5** สำรอง DB แล้ว restore ลง Postgres แยกใน local เช็กว่า avatar ยังอยู่และแอปอ่านข้อมูลได้ ซ้อมกลับ image ก่อนหน้า ใช้ schema ที่รองรับทั้งสองเวอร์ชัน หรือระบุขั้นตอนกู้ DB หาก migration ย้อนด้วย image อย่างเดียวไม่ได้
- [ ] **5.6** จดสเปกเครื่อง, ระยะเวลา, จำนวนตัวอย่าง, p95, อัตราผ่าน และโหลดสูงสุดที่ยังผ่านเกณฑ์ แยกคอขวดระหว่างเครื่องรัน load generator, เซิร์ฟเวอร์ และเครื่องผู้เล่น ถ้า 20 คนยังไม่ผ่าน ให้แก้แล้วรันซ้ำ หรือกำหนดขนาด playtest ตามผลที่ผ่านจริง

**ผ่านเมื่อ** มีรายงาน local load test, ผลซ้อมล่มและกู้ระบบ และตัวเลขรองรับขนาด playtest ที่เลือก ผล local ใช้ตัดสินการทดสอบในสภาพแวดล้อมนั้น ส่วนเพดานของ VM ต้องอาศัยผลวัดบน VM แยกต่างหาก

## 6. Review แล้วส่งขึ้น GitHub

- [ ] **6.1** ให้ AI ตรวจ diff เทียบ scope และ contract โดยเน้น route guard, สิทธิ์ join, session และ token, การ cleanup, migration, config และไฟล์ที่อาจมี secret ให้ผู้ดูแลอ่านและตัดสินประเด็นที่ review พบ
- [ ] **6.2** แก้ข้อที่พบและรัน format check, typecheck, lint, unit/integration, build และ E2E ซ้ำ บันทึกผลที่ตรวจได้และรายการที่ยังรอตรวจ เช่น DNS และสิทธิ์ไมค์ผ่านโดเมน VM
- [ ] **6.3** เตรียมขั้นตอน start, stop, health check, backup/restore, deploy และ rollback ตรวจ Git diff และยืนยันว่า path ที่จะ push มีเฉพาะ Mini Connecta กับไฟล์ที่ตั้งใจส่ง
- [ ] **6.4** เมื่อ owner อนุมัติให้ push ใช้ GitHub Actions รัน checks รวมการตรวจ OpenAPI และ generated types แล้ว build image ของ web/API/game ตาม commit SHA พร้อม image bundle และ checksum ที่ใช้ส่งเข้า VM คณะผ่านช่องทางที่คณะอนุญาต หากมี private registry ของคณะให้ใช้ registry ได้

**ผ่านเมื่อ** มี commit ที่ผ่าน CI, image ที่นำเข้า VM คณะได้ และขั้นตอน deploy/rollback ที่อ้างถึง release เดียวกัน จากนั้นให้ owner เริ่มขั้น 7

## 7. ให้ owner deploy บน VM ของคณะแล้วทำ smoke test

- [ ] **7.1** ยืนยันสิทธิ์ VM, DNS, TLS, firewall และเส้นทางเข้าถึงกับคณะ ติดตั้ง Docker/Compose เปิด HTTPS/WSS ผ่าน Caddy และเปิด LiveKit media ports ตาม config ที่ได้รับอนุญาต ให้ Postgres, metrics และ dashboard ใช้เครือข่ายภายในหรือเข้าผ่านช่องทางผู้ดูแล
- [ ] **7.2** ลง secrets ของ VM และตั้ง Google OAuth callback ให้ตรง HTTPS domain เช็ก IP ที่ LiveKit ประกาศให้ client และเส้นทาง UDP/TCP ตามเครือข่ายคณะ ถ้าต้องรองรับเครือข่ายที่บล็อก UDP ให้ตรวจ TURN/TLS ด้วย
- [ ] **7.3** นำเข้า image ตาม commit SHA จาก image bundle หรือ private registry ของคณะ รัน `prisma migrate deploy` เป็น job เดียวแล้วเปิด stack เช็ก health, logs, การเข้าถึง dashboard และลอง backup นอก VM เมื่ออัปเดตรอบถัดไป ให้เก็บ backup และระบุเวอร์ชันเดิมก่อน migrate
- [ ] **7.4** ทำ smoke test ผ่านโดเมนจริงจากสองเครื่องบนเส้นทางเครือข่ายที่คณะอนุญาต และทดสอบข้ามเครือข่ายเมื่อเส้นทางรองรับ ลอง sign-in, เซฟ avatar, reload, เข้า Discover, join, เห็นกันเดิน, เปิดไมค์, เดินเข้า–ออกระยะ และ Leave เช็ก Grafana และ logs ว่าเห็นเหตุการณ์จากการใช้งานจริง
- [ ] **7.5** ถ้า smoke test ตก ให้ owner หยุดเปิด playtest แก้ตามสาเหตุหรือ rollback แล้วรัน smoke ซ้ำ ถ้าผ่าน ให้จด URL, commit SHA, ผล smoke test และจำนวนคนที่ตกลงรับในรอบแรก

**Release 1 เสร็จเมื่อ** ผู้ใช้สองคนผ่าน flow บน VM จริง ทีมดูอาการจาก dashboard และ logs ได้ และมีผลซ้อม restore กับ rollback จาก local ให้ใช้อ้างอิง

## แหล่งอ้างอิง

- [Study Room 3D V1 — โครงระบบและคำสั่ง dev](../../Project-StudyRoom3d/README.md)
- [Study Room 3D — Compose และ Caddy](../../Project-StudyRoom3d/infra/compose/README.md)
- [Study Room 3D — Observability, SLO และ drills](../../Project-StudyRoom3d/infra/observability/README.md)
- [Connecta V2 — แผน port และ tech stack](../../Project-StudyRoom3d/docs/v2-plan.md)
- [Better Auth — Google Sign-in](https://better-auth.com/docs/authentication/google) และ [Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [LiveKit — Ports และ firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/) และ [Load testing](https://docs.livekit.io/reference/developer-tools/livekit-cli/perf/)
