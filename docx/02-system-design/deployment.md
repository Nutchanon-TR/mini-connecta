# Deployment design สำหรับ local และ VM

ใช้เว็บ, API, Game, PostgreSQL และ LiveKit อย่างละหนึ่ง instance ให้ Caddy เป็นทางเข้าเว็บและ signaling บน VM ส่วน media ของ WebRTC วิ่งเข้าพอร์ต LiveKit โดยตรง

## บริการและสภาพแวดล้อม

| บริการ | Local | VM |
| --- | --- | --- |
| Caddy + Web | `http://localhost:8080` โดย bind รับจากเครื่องตัวเอง | `https://mini.example.org` ผ่าน Caddy |
| API | Browser เรียก `/api/*` จาก origin เดียวกัน | Caddy ส่ง path เดิมเข้า API ใน private network |
| Colyseus | `ws://localhost:2567` รวม HTTP matchmaking บน host/port เดียวกัน | `wss://game.mini.example.org` ผ่าน Caddy โดยรองรับ HTTP matchmaking |
| LiveKit signaling | `ws://localhost:7880` สำหรับ browser | `wss://rtc.mini.example.org` ผ่าน Caddy |
| PostgreSQL | อยู่ใน Compose network ถ้าต้องการใช้ psql จาก host ให้ bind loopback | อยู่ใน Compose network และเก็บข้อมูลบน persistent volume |
| Monitoring | เปิด observability profile เมื่อทำ local tests | เปิด scrape/log collectors และเข้าดู Grafana ผ่าน SSH tunnel หรือช่องทางผู้ดูแล |

ชื่อตัวอย่างต้องเปลี่ยนให้ตรงกับโดเมนของ VM ส่วน Browser URL แยกจากชื่อ service ภายใน เช่น Game ใช้ `http://livekit:7880` สำหรับ Room Service และคืน `wss://rtc.mini.example.org` ให้ client

โหมด frontend mock ในขั้น 3 รันโดยไม่ต้องเปิด DB, Game หรือ LiveKit โหมด integration ในขั้น 4 ใช้ Compose ทั้ง stack และตรวจ full path ผ่าน Caddy ใน local สำหรับ Google OAuth จริงยังต้องใช้อินเทอร์เน็ตและ OAuth client สำหรับ local กรณีที่ทดสอบมือถือใน LAN ให้ใช้ HTTPS ที่อุปกรณ์ trust หรือทดสอบผ่าน secure origin ที่จัดไว้

## DNS, firewall และ voice

| Inbound บน VM | ใช้กับ |
| --- | --- |
| `80/tcp` และ `443/tcp` | Caddy ใช้ redirect/TLS และรับ HTTPS กับ WSS ของทั้งสาม host names |
| `7881/tcp` | LiveKit WebRTC TCP fallback ตาม config |
| `7882/udp` | LiveKit ICE/UDP mux ตาม config |
| ช่องทางผู้ดูแล | ใช้ช่องทางที่ผู้ให้บริการ VM รองรับ หรือจำกัด SSH ตาม network ของผู้ดูแล |

ใช้ firewall ของ cloud และของ VM ให้ตรงกัน ตั้ง LiveKit ให้โฆษณา IP ที่ client เข้าถึงได้จากภายนอก กำหนด `rtc.udp_port` ตรงกับพอร์ตที่เปิด ปลายทาง DB, metrics และ LiveKit `7880` อยู่ภายใน ตรวจ Caddy routing และ access control สำหรับ `/metrics`, `/internal/*` และ Grafana

อนุญาตเฉพาะ web origin ที่ตั้งค่าไว้สำหรับ Game HTTP matchmaking และตรวจ WebSocket Origin credentials ของ API อยู่บนเว็บ origin เดียวกัน ส่วน Game ตรวจตั๋วของตัวเอง ให้ API เรียก `/internal/room` ผ่าน private network เท่านั้น บล็อก path นี้ที่ Caddy และให้ listener ของ internal route รับเฉพาะ private network แยกจาก browser endpoints

ถ้า Wi-Fi มหาวิทยาลัยหรือ VPN บล็อกทั้ง UDP และ WebRTC TCP fallback ให้ทดสอบ TURN/TLS ก่อนเปิด playtest หากต้องใช้ TURN/TLS บน `443` ให้จัด endpoint ที่รับ TCP `443` ของ TURN ได้ เช่น IP หรือโฮสต์แยก หรือ managed TURN ที่รองรับ topology นี้ Caddy ครอง `443` บน public IP เดิมอยู่แล้ว ทดสอบเสียงจริงจากอย่างน้อยสองเครือข่าย

[LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/) · [LiveKit ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/)

## Config และ secrets

| Config | ใครอ่าน | Local และ VM |
| --- | --- | --- |
| `APP_ORIGIN` | API และ Game | Origin ของเว็บสำหรับตรวจ request |
| `BETTER_AUTH_URL` | API | URL สาธารณะที่ client ใช้สำหรับ OAuth callback |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` | API | แยก OAuth client และ secret ต่อ environment |
| `DATABASE_URL` | API, migration job | แยก credential ของ runtime และ migration ใน VM |
| `ROOM_JOIN_SECRET` | API และ Game | ใช้ค่าเดียวกันภายใน environment เดียว แยกจาก auth secret |
| `GAME_WS_URL`, `GAME_INTERNAL_URL` | API | public endpoint ที่คืนให้ browser และ private endpoint สำหรับ lookup ห้อง |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Game และ LiveKit | แยก local/VM |
| `LIVEKIT_INTERNAL_URL`, `LIVEKIT_PUBLIC_URL` | Game | Service endpoint ภายในและ client endpoint ภายนอก |
| `ROOM_CAPACITY` | Game | เริ่ม 20 สำหรับ playtest และเพิ่มเฉพาะ local load test เมื่อต้องลอง 30 คน |

ตั้ง Google redirect URI ให้ถูกทั้งสองค่า เช่น `http://localhost:8080/api/auth/callback/google` และ `https://mini.example.org/api/auth/callback/google` เว็บใช้ API แบบ relative path เพื่อให้ image เดียวใช้ได้กับทั้ง env ตัวแปรที่ส่งมาถึง browser มีเพียง config สาธารณะ

เก็บตัวอย่างชื่อ key ใน `.env.example` และให้ owner ใส่ค่าจริงในไฟล์จำกัดสิทธิ์หรือ secret store ของ VM ส่งแต่ละ secret เฉพาะบริการที่ใช้ รัน config validation ก่อนเปิดบริการและ scrub token/session จาก access logs [Better Auth Google callback](https://better-auth.com/docs/authentication/google)

## Build, deploy และ recovery

1. Local ใช้ Compose เพื่อทดสอบจาก DB ว่างและ DB ที่มีข้อมูล รัน migration job หนึ่งครั้งและรอสำเร็จก่อน start API เปิด Game เมื่อ room registry พร้อมและเช็ก Web/Caddy จนเปิดหน้าได้
2. CI ตรวจ format/type/lint/tests/build สร้าง web, API และ Game images ตาม commit SHA เก็บ config และ migration version คู่กับ release ใช้ image เดียวกับ API สำหรับ job migration
3. Owner ทำ backup ก่อน migration เมื่อมีข้อมูลแล้ว ดึง image ตาม SHA รัน migration หนึ่งครั้งใน stack ที่กำหนดและเช็กผล ก่อนสลับ app ไป release ใหม่ หาก schema ไม่เข้ากับเวอร์ชันเดิม ให้หยุด write ระหว่างเปลี่ยน
4. เช็ก readiness, OAuth callback, WSS, dashboard และเสียงจากสองเครื่องคนละเครือข่าย ใช้ขั้นตอน smoke ตาม [แผนขั้น 7](../plan.md)
5. ถ้า smoke ตก ให้หยุดเปิด playtest กลับไป SHA ก่อนหน้าเมื่อ schema ยังเข้ากัน ถ้า schema ไม่เข้ากัน ให้กู้ backup ลง instance แยก ใช้ app release ที่ตรงกัน ตรวจข้อมูลก่อนสลับ endpoint และบันทึกช่วงข้อมูลหลัง backup ที่อาจหาย

บันทึก `pg_dump` แบบ custom format นอก VM ก่อนเปลี่ยน release และทุกวันระหว่าง playtest เป็นค่าเริ่มต้น ใช้ version/เวลา dump และผล restore เป็นหลักฐาน คุยกับทีมเรื่องระยะเก็บ backup ตามช่วงใช้งาน เตรียมวิธี restore ให้ DB และ volume บนเครื่องเดียวกันเสียได้โดยยังมีสำเนาข้อมูล

## Health และ cache

- API liveness วัดว่า process ตอบได้ ส่วน readiness เช็ก DB และ migration version Game readiness เช็กว่าห้อง singleton เปิดให้ join แล้ว โดยอาการเสียงล่มแสดงบน monitoring แยก
- Web และ API อยู่หลัง Caddy ส่วน readiness, DB, Prometheus, Alertmanager และ Loki เปิดภายในเท่านั้น ตั้ง log rotation กับ retention ตามขนาด disk
- Static assets ที่ชื่อมี content hash ใช้ long-lived browser cache ได้ หน้า HTML และไฟล์ที่ชื่อไม่เปลี่ยนตามเนื้อหาใช้ revalidation ส่วน auth, avatar และ join ใช้ `no-store`
- ใช้ Redis หรือแยกบริการออกจาก VM เดียวเมื่อผลเทสชี้ปัญหา resource หรือมีงานขยายหลาย instance เมื่อ Game หรือ VM restart ผู้เล่นต้องเข้าห้องใหม่ เมื่อ LiveKit restart ให้ผู้เล่นเดินต่อได้และเริ่มการเชื่อมเสียงใหม่โดยไมค์ปิด

[Compose/Caddy ของ V1](../../../Project-StudyRoom3d/infra/compose/README.md)
