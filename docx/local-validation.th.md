# Mini Connecta · วิธีวัดผลใน local

## รันชุดตรวจ

~~~sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @mini-connecta/web api:check
pnpm --filter @mini-connecta/web build
docker compose exec -T api pnpm openapi:check
node scripts/mock-e2e.mjs
node scripts/real-e2e.mjs
node scripts/guest-e2e.mjs
~~~

เปิด mock ด้วย `pnpm --filter @mini-connecta/web start -p 3215` หลัง build Mock E2E ใช้เว็บ mock ที่พอร์ต 3215 โดยตั้ง `MOCK_URL` ได้ Real E2E ใช้ Compose ที่พอร์ต 8080 และสร้าง session ผ่าน Better Auth test plugin ที่อยู่ใน CLI สำหรับ local fixture เท่านั้น Edge เป็นค่าเริ่มต้น ตั้ง `PLAYWRIGHT_CHANNEL=chrome` ได้ การทดสอบเสียงใช้ fake microphone และตรวจ track กับ volume ใน browser ส่วนการฟังจริงใช้สองเครื่อง

## โหลด สัญญาณเตือน และกู้ระบบ

- API ใช้ `node scripts/load-sessions.mjs 30` ก่อนแต่ละรอบเพื่อออก session ใหม่และหลีกเลี่ยง throttling ข้ามรอบ ตัวอย่าง k6 ดูด้านล่าง
- Game ใช้ `pnpm exec tsx scripts/load-game.mts 5 10` สำหรับ 5 คน 10 วินาที ไล่ 5, 10, 20 และ 30 ตั้ง `ROOM_CAPACITY=30` แล้ว recreate game ก่อนทดสอบระดับ 30
- Voice ใช้ `node --env-file=.env scripts/load-voice.mjs 5 10s` ไล่จำนวนเท่ากัน ตั้ง `LK_BIN` หาก `lk` ยังไม่อยู่ใน PATH [LiveKit CLI load testing](https://docs.livekit.io/reference/developer-tools/livekit-cli/perf/)
- คะแนน API มาจาก k6 ส่วน join/movement ของบอตมาจาก Colyseus SDK และ packet loss มาจาก LiveKit CLI browser E2E วัดการ join จริงตั้งแต่กด Walk in
- ทดสอบห้องเต็ม ตั๋วหมดอายุ และ reconnect ด้วย `pnpm exec tsx scripts/admission-check.mts` ขณะที่ Game ตั้ง `ROOM_CAPACITY=2`
- ทดสอบ workload รวมด้วย `node scripts/combined-e2e.mjs` จาก local stack ที่รับ 20 คนได้
- ซ้อม API/DB หยุดด้วย `node scripts/ops-drill.mjs` ขณะเปิด monitoring และทดสอบ LiveKit หยุดจาก browser ด้วย `E2E_VOICE_DRILL=1` ก่อนรัน Real E2E ใช้ `E2E_GAME_DRILL=1` เพื่อซ้อม game restart
- ตรวจ disk alert ด้วย `promtool test rules` จากโฟลเดอร์ `infra/observability` ใช้ข้อมูลจำลองใน `alerts.test.yml` เพื่อทดสอบ threshold และ resolve
- ใช้ [Runbook](runbook.th.md) ทำ backup/restore พร้อมสรุปจำนวน avatar และตรวจ release tag ก่อน rollback

~~~sh
docker run --rm --network mini-connecta_edge -e USERS=5 \
  -v "$PWD/scripts/load-api.js:/test.js:ro" -v "$PWD/artifacts:/data:ro" \
  grafana/k6:1.4.2 run --quiet /test.js
~~~

เพิ่ม `-e API_MODE=me` ในคำสั่ง Docker ด้านบนเพื่อยิงเฉพาะ `GET /api/me` หลังเตรียม session และ avatar ด้วย `node scripts/load-sessions.mjs 5` ใช้ผล k6 ตรวจ API บัญชีในโหมดนี้ เปิด **Study Room Overview** สำหรับดูผล Join, Voice และ Reconnect จากการทดสอบห้อง


## ผลเทสวันที่ 24 พฤศจิกายน 2026

เครื่องทดสอบ Windows, AMD Ryzen 7 7730U, Docker Desktop Linux 16 vCPU / RAM 7.43 GiB และ Edge headless แบบ muted ใช้ PostgreSQL 17 และ LiveKit 1.13.11 โหลดและระบบอยู่บนเครื่องเดียวกัน

| คนพร้อมกัน | API requests / fail | API p95 / p99 (ms) | Bot join p95 (ms) | Movement ACK p95 / samples | LiveKit audio subscriptions |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 80 / 0 | 23.40 / 27.01 | 200.0 | 52.7 ms / 525 | 4 / 4 |
| 10 | 160 / 0 | 39.76 / 42.42 | 194.5 | 51.8 ms / 1,043 | 16 / 16 |
| 20 | 320 / 0 | 62.22 / 70.44 | 250.9 | 54.2 ms / 2,084 | 75 / 75 |
| 30 | 480 / 0 | 112.05 / 120.61 | 297.5 | 52.2 ms / 3,122 | 138 / 161 |

รอบแยกใช้เวลา 8 วินาทีต่อระดับหลังเริ่มกลุ่ม API ใช้ session ใหม่ก่อนแต่ละรอบ หลังรอบแรกที่ใช้ session ซ้ำแตะเพดาน rate limit ที่ฝั่ง Join Colyseus ไม่พบ drop หรือ Leave ที่ไม่คาดหมาย LiveKit CLI รายงาน packet loss 0% ของ track ที่รับได้ ที่ 30 คนมี 23 subscriptions ที่ไม่ครบ ผลรอบ 30 คนจึงใช้ยืนยันความจุเสียงไม่ได้ ผู้ฟังทั้ง 23 คนได้ 6 จาก 7 tracks เหมือนกัน ชี้ไปที่ track ของ publisher หนึ่งราย แต่ผลนี้ยังแยกเหตุระหว่างตัวสร้างโหลดกับฝั่ง RTC ไม่ได้

Baseline สอง browser contexts ผ่าน Join, รับผู้เล่นอีกคน, เดินออกแล้วกลับเข้าระยะเสียง, ปิดไมค์, Leave และ Sign-out เวลา Walk in ถึงแสดง canvas 2,448 และ 930 ms เปิดไมค์จนอีกฝั่งเห็น audio track ใช้ 316 ms ตัวอย่าง frame callback 60 FPS ใน 1.5 วินาที ตัวเลขนี้ใช้เทียบภายใต้เงื่อนไขการทดสอบเดียวกัน

Prometheus scrape API, Game, LiveKit และ node exporter ได้ ตรวจ counter จาก Join/Voice และค้น structured logs ผ่าน Loki ในการทดสอบรอบนั้น ปัจจุบันดู log ผ่าน `docker compose logs` ค่าที่วัดเป็นผล local ระยะสั้น ดูผล workload รวมด้านล่างสำหรับจำนวนคนที่ผ่านเกณฑ์เวลา Join

## Review ขั้น 6.1–6.3

| จุดตรวจ | สิ่งที่พบและการแก้ |
| --- | --- |
| Session และ OAuth | แก้ Better Auth ให้สร้าง UUID ตอน adapter insert และจำกัด cookie ไว้ที่ `/api` ทดสอบ route guard และ Sign-out ด้วย DB-backed fixture |
| Ticket และ CORS | แยก CORS ของ Game ออกจาก cookie ของบัญชี ตรวจ instance, expiry, nonce, seat และบัญชีซ้ำ |
| Reload และเสียง | ผูก input, voice และ track cleanup กับรอบ Game connection ทดสอบ mock และระบบจริงแยกกัน |
| Config และข้อมูลส่วนตัว | ระบุ env ตามบริการ ซ่อน ops endpoints จาก Caddy และตัด query ของ URL จาก E2E diagnostics |
| Migration และข้อมูล | Compose รอ migration job ก่อน API เปิด ใช้ PostgreSQL แยกสำหรับ restore |
| ชุดไฟล์ | ตรวจ diff แบบอ่านอย่างเดียวในราก Mini-Connecta ยืนยันว่า .env, fixture sessions, dumps, generated Prisma client และเว็บ build ถูก ignore |

งานที่ต้องตรวจด้วย credentials หรืออุปกรณ์จริงคือ Google OAuth callback สำเร็จ การฟังเสียงจากสองเครื่อง และ DNS/TLS/firewall ของ VM


## Workload รวม

รันผ่าน Caddy ด้วย browser contexts ในห้องเดียวกัน ทยอยเข้าออกกลุ่มละไม่เกิน 4 คน เปิดไมค์จำลอง 4 คน และตรวจ audio tracks ที่ผู้ฟังได้รับระหว่างส่ง movement

| คน | คนเดินได้ | Audio checks ผ่าน | Walk in ถึง canvas p95 | ผลตามเกณฑ์ Join 5 วินาที |
| ---: | ---: | ---: | ---: | --- |
| 20 | 20/20 | 64/64 | 5.07 s | เกินเวลาเป้า |
| 15 | 15/15 | 44/44 | 2.97 s | 15/15 จาก browser telemetry |

ในจุดเก็บตัวอย่างที่ 20 คน Docker รายงาน CPU ของ API 5.04%, Game 17.03% และ LiveKit 96.95% กับ RAM 285.6, 176.2 และ 113.3 MiB ตามลำดับ API และ bot join แยกยังต่ำกว่า 0.3 วินาทีที่ 20 คน เวลา Walk in ของ browser มีเพิ่มจากการโหลดและ render ฉากและ overhead ของเครื่องที่เปิด browser หลาย context พร้อมกัน ผลในเครื่องนี้จึงรองรับการเริ่มที่ **15 คน** และตรวจใหม่บน VM

## ผลซ้อมกู้ระบบ

- หยุด PostgreSQL แล้ว API readiness กับบัญชีตอบ 503 หลังเปิด PostgreSQL กลับ API ตอบ 200 ได้
- หยุด API แล้ว Caddy ตอบ 502 Alertmanager ได้รับ `MiniServiceDown` และ alert resolve หลังเปิด API กลับ
- ทดสอบ disk alert ด้วย `promtool` ผ่าน ทั้งก่อนครบ 10 นาที ตอน fire และเมื่อค่าพื้นที่ว่างกลับมา
- ทดสอบ Colyseus room capacity 2 คน ห้องเต็ม บัญชีซ้ำ ตั๋วหมดอายุ SDK reconnect และคืนที่นั่งผ่าน
- ใช้ `pg_dump` แล้ว `pg_restore` ลง PostgreSQL แยก API ที่ชี้ไปฐานที่กู้แล้วอ่าน avatar และ preset เดิมผ่าน
- ซ้อมสลับ tag `local` → `rollback-local` → `local` ใช้ schema เดิม Readiness และ avatar เดิมผ่านทุกครั้ง
- ซ้อมหยุด LiveKit ระหว่างผู้เล่นอยู่ในห้อง Browser แสดง Voice unavailable และ Game ยังเชื่อมต่อได้
- ซ้อม restart Game ขณะมีผู้เล่นสองคน Browser แสดง Reconnect ผู้เล่นทั้งคู่ขอตั๋วใหม่ กลับเข้าห้อง และเริ่มด้วยไมค์ปิดได้
