# Deployment design สำหรับ local และ VM ของคณะ

เป้าหมายคือ Linux VM on-premises ในเครือข่ายคณะ ใช้เว็บ, API, Game, PostgreSQL และ LiveKit อย่างละหนึ่ง instance ใน Docker Compose ให้ Caddy เป็นทางเข้าเว็บและ signaling ส่วน media ของ WebRTC วิ่งเข้าพอร์ต LiveKit ตามเส้นทางที่คณะอนุญาต

## บริการและสภาพแวดล้อม

| บริการ | Local | VM คณะ |
| --- | --- | --- |
| Caddy + Web | `http://localhost:8080` โดย bind รับจากเครื่องตัวเอง | `https://mini.example.org` ผ่าน Caddy |
| API | Browser เรียก `/api/*` จาก origin เดียวกัน | Caddy ส่ง path เดิมเข้า NestJS API ใน private network |
| Colyseus | `ws://localhost:2567` รวม HTTP matchmaking บน host/port เดียวกัน | `wss://game.mini.example.org` ผ่าน Caddy โดยรองรับ HTTP matchmaking |
| LiveKit signaling | `ws://localhost:7880` สำหรับ browser | `wss://rtc.mini.example.org` ผ่าน Caddy |
| PostgreSQL | อยู่ใน Compose network ถ้าต้องการใช้ psql จาก host ให้ bind loopback | PostgreSQL อยู่ใน Compose private network เก็บข้อมูลบน persistent volume และ backup ไป storage แยกจาก VM |
| Monitoring | เปิด observability profile เมื่อทำ local tests | ใช้ observability profile บน VM เดียวช่วงแรก เข้าดู Grafana ผ่านช่องทางผู้ดูแลที่คณะอนุญาต |

ชื่อตัวอย่างต้องเปลี่ยนให้ตรงกับโดเมนที่คณะจัดให้ ส่วน Browser URL แยกจากชื่อ service ภายใน เช่น Game ใช้ `http://livekit:7880` สำหรับ Room Service และคืน `wss://rtc.mini.example.org` ให้ client

โหมด frontend mock ในขั้น 3 รันโดยไม่ต้องเปิด DB, Game หรือ LiveKit โหมด integration ในขั้น 4 ใช้ Compose ทั้ง stack และตรวจ full path ผ่าน Caddy ใน local สำหรับ Google OAuth จริงยังต้องใช้อินเทอร์เน็ตและ OAuth client สำหรับ local กรณีที่ทดสอบมือถือใน LAN ให้ใช้ HTTPS ที่อุปกรณ์ trust หรือทดสอบผ่าน secure origin ที่จัดไว้

## DNS, firewall และ voice

| Inbound บน VM | ใช้กับ |
| --- | --- |
| `80/tcp` และ `443/tcp` | Caddy รับ web และ signaling ผ่านทางที่คณะอนุญาต ใช้ `80/tcp` หากต้อง redirect หรือรองรับการออก TLS ที่เลือก |
| `7881/tcp` | LiveKit WebRTC TCP fallback ตาม config |
| `7882/udp` | LiveKit ICE/UDP mux ตาม config |
| ช่องทางผู้ดูแล | ใช้ management network, VPN หรือ bastion ที่คณะจัดให้ จำกัด SSH ตามนโยบายผู้ดูแล |

ยืนยัน DNS, TLS และการเข้าถึงจาก campus/VPN/ภายนอกกับคณะก่อนกำหนดกลุ่ม playtest ให้ firewall ของคณะและของ VM อนุญาตเส้นทางตรงกัน ถ้า VM อยู่หลัง NAT ให้คณะยืนยันการส่งต่อพอร์ตและ IP ที่ LiveKit ต้องประกาศ ตั้ง LiveKit ให้โฆษณา IP ที่ client ในกลุ่มเป้าหมายเข้าถึงได้ กำหนด `rtc.udp_port` ตรงกับพอร์ตที่เปิด ปลายทาง DB, metrics และ LiveKit `7880` อยู่ภายใน ตรวจ Caddy routing และ access control สำหรับ `/metrics`, `/internal/*` และ Grafana

อนุญาตเฉพาะ web origin ที่ตั้งค่าไว้สำหรับ Game HTTP matchmaking และตรวจ WebSocket Origin credentials ของ API อยู่บนเว็บ origin เดียวกัน ส่วน Game ตรวจตั๋วของตัวเอง ให้ API เรียก `/internal/room` ผ่าน private network เท่านั้น บล็อก path นี้ที่ Caddy และให้ listener ของ internal route รับเฉพาะ private network แยกจาก browser endpoints

ถ้า Wi-Fi มหาวิทยาลัยหรือ VPN บล็อกทั้ง UDP และ WebRTC TCP fallback ให้ทดสอบ TURN/TLS ก่อนเปิด playtest หากต้องใช้ TURN/TLS บน `443` ให้จัด endpoint ที่รับ TCP `443` ของ TURN ได้ เช่น IP หรือโฮสต์แยก หรือ TURN ที่คณะจัดให้ Caddy อาจใช้ `443` บน IP เดียวกันอยู่แล้ว ทดสอบเสียงจริงจากสองเครื่องและข้ามเครือข่ายเมื่อเส้นทางได้รับอนุญาต

[LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/) · [LiveKit ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/)

## Config และ secrets

| Config | ใครอ่าน | Local และ VM |
| --- | --- | --- |
| `APP_ORIGIN` | API และ Game | Origin ของเว็บสำหรับตรวจ request |
| `BETTER_AUTH_URL` | API | HTTPS origin ที่ผู้ทดสอบเข้าถึงได้สำหรับ OAuth callback |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` | API | แยก OAuth client และ secret ต่อ environment |
| `DATABASE_URL` | API, migration job | แยก credential ของ runtime และ migration ใน VM |
| `ROOM_JOIN_SECRET` | API และ Game | ใช้ค่าเดียวกันภายใน environment เดียว แยกจาก auth secret |
| `GAME_WS_URL`, `GAME_INTERNAL_URL` | API | public endpoint ที่คืนให้ browser และ private endpoint สำหรับ lookup ห้อง |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Game และ LiveKit | แยก local/VM |
| `LIVEKIT_INTERNAL_URL`, `LIVEKIT_PUBLIC_URL` | Game | Service endpoint ภายในและ client endpoint ภายนอก |
| `ROOM_CAPACITY` | Game | เริ่ม 20 สำหรับ playtest และเพิ่มเฉพาะ local load test เมื่อต้องลอง 30 คน |

ตั้ง Google redirect URI ให้ถูกทั้งสองค่า เช่น `http://localhost:8080/api/auth/callback/google` และ `https://mini.example.org/api/auth/callback/google` เว็บใช้ API แบบ relative path เพื่อให้ image เดียวใช้ได้กับทั้ง env ตัวแปรที่ส่งมาถึง browser มีเพียง config สาธารณะ

เก็บตัวอย่างชื่อ key ใน `.env.example` และให้ owner ใส่ค่าจริงในไฟล์จำกัดสิทธิ์หรือ secret store ที่คณะจัดให้ ส่งแต่ละ secret เฉพาะบริการที่ใช้ รัน config validation ก่อนเปิดบริการและ scrub token/session จาก access logs [Better Auth Google callback](https://better-auth.com/docs/authentication/google)

## Build, deploy และ recovery

1. Local ใช้ Compose เพื่อทดสอบจาก DB ว่างและ DB ที่มีข้อมูล รัน migration job หนึ่งครั้งและรอสำเร็จก่อน start API เปิด Game เมื่อ room registry พร้อมและเช็ก Web/Caddy จนเปิดหน้าได้
2. GitHub Actions ตรวจ format/type/lint/tests/build และความตรงของ OpenAPI กับ generated types สร้าง web, API และ Game images สำหรับ CPU architecture ของ VM ติด tag ตาม commit SHA แล้ว export เป็น Docker image archive พร้อม SHA-256 checksum เก็บ Compose/config ที่ไม่มี secret และ migration version คู่กับ release ใช้ API image เดียวกับ migration job โดยให้ image นั้นมี Prisma CLI ที่ต้องใช้
3. Owner ส่ง archive ผ่านช่องทางที่คณะอนุญาต ตรวจ checksum แล้วใช้ `docker load` บน VM หากคณะมี private registry ให้ใช้ image tag ของ commit จาก registry ได้ ทำ backup ก่อน migration เมื่อมีข้อมูลแล้ว รัน `prisma migrate deploy` เป็น job เดียวและเช็กผลก่อนสลับ app ไป release ใหม่ หาก schema ไม่เข้ากับเวอร์ชันเดิม ให้หยุด write ระหว่างเปลี่ยน
4. เช็ก readiness, OAuth callback, WSS, dashboard และเสียงจากสองเครื่องบนเส้นทางเครือข่ายที่คณะอนุญาต ใช้ขั้นตอน smoke ตาม [แผนขั้น 7](../plan.md)
5. ถ้า smoke ตก ให้หยุดเปิด playtest กลับไป SHA ก่อนหน้าเมื่อ schema ยังเข้ากัน ถ้า schema ไม่เข้ากัน ให้กู้ backup ลง instance แยก ใช้ app release ที่ตรงกัน ตรวจข้อมูลก่อนสลับ endpoint และบันทึกช่วงข้อมูลหลัง backup ที่อาจหาย

บันทึก `pg_dump` แบบ custom format ไป storage ของคณะหรือพื้นที่ที่คณะอนุญาตซึ่งอยู่นอก VM ก่อนเปลี่ยน release และทุกวันระหว่าง playtest เป็นค่าเริ่มต้น ใช้ version/เวลา dump และผล restore เป็นหลักฐาน คุยกับทีมเรื่องระยะเก็บ backup ตามช่วงใช้งาน เตรียมวิธี restore ให้ DB และ volume บนเครื่องเดียวกันเสียได้โดยยังมีสำเนาข้อมูล

## Health และ cache

- ใช้ `@nestjs/terminus` แยก liveness ของ API ออกจาก readiness ที่เช็ก PostgreSQL และความพร้อมของ schema Game readiness เช็กว่าห้อง singleton เปิดให้ join แล้ว โดยอาการเสียงล่มแสดงบน monitoring แยก
- Web และ API อยู่หลัง Caddy ส่วน readiness, DB, Prometheus, Alertmanager และ Loki เปิดภายในเท่านั้น ตั้ง log rotation กับ retention ตามขนาด disk
- Static assets ที่ชื่อมี content hash ใช้ long-lived browser cache ได้ หน้า HTML และไฟล์ที่ชื่อไม่เปลี่ยนตามเนื้อหาใช้ revalidation ส่วน auth, avatar และ join ใช้ `no-store`
- ใช้ Redis หรือแยกบริการออกจาก VM เดียวเมื่อผลเทสชี้ปัญหา resource หรือมีงานขยายหลาย instance เมื่อ Game หรือ VM restart ผู้เล่นต้องเข้าห้องใหม่ เมื่อ LiveKit restart ให้ผู้เล่นเดินต่อได้และเริ่มการเชื่อมเสียงใหม่โดยไมค์ปิด

[NestJS health checks](https://docs.nestjs.com/recipes/terminus) · [Compose/Caddy ของ V1 สำหรับอ้างอิงรูปแบบ config](../../../Project-StudyRoom3d/infra/compose/README.md)
