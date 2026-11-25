# Backend, API และ realtime contract

ใช้คู่กับ [Database](database.md), [Deployment](deployment.md) และ [Observability](observability.md) ตัวอย่างในเอกสารนี้ใช้ทำ mock ของขั้น 3 ได้

## ขอบเขตของแต่ละ package

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `apps/api` | NestJS controllers/guards, Better Auth handler, OpenAPI, บันทึก avatar, ออก join ticket และรับ telemetry |
| `apps/game` | รับ ticket, คุมห้องและการเดิน, ออก token เสียง, จัดการ leave/reconnect |
| `packages/shared` | IDs, Zod schemas สำหรับ realtime, movement messages และ map/collision rules ที่ใช้ร่วมกัน |
| `packages/db` | Prisma schema, migrations และ client สำหรับ API |
| `apps/web` | Feature modules สำหรับ auth, avatar, discover, room และ voice เรียก HTTP client กลางที่ `src/lib/api.ts` |

ขั้น 3 ใช้ [OpenAPI snapshot](../../apps/api/openapi.snapshot.json) ของ REST contract ด้านล่าง ใช้ `openapi-typescript` สร้าง types ให้ mock และใช้ `openapi-fetch` เป็น HTTP client กลาง ขั้น 4 ให้ NestJS DTO และ `@nestjs/swagger` ออก spec จาก routes จริง แล้ว generate types จาก spec นั้น ตรวจ contract และผล generate ใน CI ใช้ Zod ตรวจ body ของ REST และ realtime ที่ขอบของแต่ละบริการ เลี่ยงการส่ง Prisma row หรือ cookie เป็น DTO

`pnpm --filter @mini-connecta/web api:generate` สร้าง types จาก snapshot และ `pnpm --filter @mini-connecta/web api:check` ตรวจว่าผล generate ตรงกัน ทำงานจากราก Mini-Connecta

## โหมดเรียก API ระหว่างพัฒนา

ค่าเริ่มต้นคือ mock transport ตอบทั้งสี่ route ด้วย types และ error codes จาก OpenAPI UI ใช้ feature API และ typed client กลาง ตั้ง `NEXT_PUBLIC_API_MODE=real` แล้วรัน dev ใหม่หรือ build ใหม่เพื่อส่ง request ไป `/api/...` บน origin เดิม Compose build เว็บในโหมด real ให้ Caddy ส่ง request ไป NestJS และ Game ดูคำสั่งใน [Runbook](../runbook.th.md) Google OAuth ต้องตั้ง credentials ของ environment นั้น

## Auth และ HTTP contract

- ต่อ Better Auth Node handler ที่ `/api/auth/*` บน Express ก่อน JSON body parser ให้ NestJS routes เรียก schema validation ก่อนจัดการข้อมูล และให้ Web ใช้ Better Auth client สำหรับ sign-in/sign-out Better Auth รองรับ Google และ Guest ผ่าน Anonymous plugin เปิด callback ของ local และ VM ตาม [Deployment](deployment.md) เมื่อ OAuth สำเร็จให้ redirect ไปจุดเริ่มแอป แล้วใช้ `GET /api/me` ตัดสินหน้า
- `POST /api/auth/sign-in/anonymous` ออก session ให้ Guest ผ่าน Better Auth จำกัด 20 ครั้งต่อนาทีต่อ IP จาก proxy `GET /api/me` ส่ง `user.isGuest` สำหรับ Guest แล้วใช้ flow สร้าง avatar และเข้าห้องเดิม Guest ออกจากระบบผ่าน `POST /api/auth/delete-anonymous-user` เพื่อล้างบัญชีและตัวละครรอบนั้น
- NestJS guard ตรวจ Better Auth session จาก cookie ในทุก route สำหรับบัญชี ตั้ง HttpOnly และ Secure บน HTTPS ใช้ same origin และตรวจ Origin สำหรับ request ที่แก้สถานะของแอป ให้ Better Auth จัดการ callback/state ของ OAuth
- ออกจากระบบผ่าน Better Auth แล้วล้าง session state ของ Web ถ้าอยู่ในห้อง ให้ Client ปิด Game และ LiveKit ก่อน sign out UI ใช้ `401 unauthorized` เป็นทางกลับหน้า Sign in
- Responses ของ session, avatar และ join ใช้ `Cache-Control: no-store` Route ที่เปลี่ยนข้อมูลรับ JSON และ validate ที่ขอบ API ใช้ `@nestjs/throttler` กับ Join และ telemetry โดยจำกัดตาม session โดยเริ่มจาก storage ใน memory ของ API instance เดียว

[Better Auth: Express integration](https://better-auth.com/docs/integrations/express) · [Google setup](https://better-auth.com/docs/authentication/google) · [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction) · [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) · [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting)

| HTTP | Request | Success | Error ที่ UI ใช้ |
| --- | --- | --- | --- |
| `GET /api/me` | Session cookie | `200` พร้อม `user` และ `avatar` หรือ `null` | `401 unauthorized`, `503 service_unavailable` |
| `PUT /api/me/avatar` | `{ displayName, preset }` | `200` คืน avatar ที่ DB บันทึกแล้ว | `400 validation_error`, `401 unauthorized`, `503 service_unavailable` |
| `POST /api/rooms/study-room/join` | `{ attemptId }` | `200` คืน `roomId`, `gameRoomId`, `gameWsUrl`, `joinTicket`, `expiresAt` | `400 validation_error`, `401 unauthorized`, `409 avatar_required`, `429 rate_limited`, `503 service_unavailable` หรือ `room_unavailable` |
| `POST /api/telemetry/room-attempts` | Signed-in cookie + start หรือ finish event | `204` รวมถึง event เดิมที่ส่งซ้ำ | `400 validation_error`, `401 unauthorized`, `429 rate_limited` |

`room_full` มาจาก Game ตอนจองที่นั่ง API ออกตั๋วได้ก่อนรู้ผลว่ามีที่ว่างจริง

### ตัวอย่างสำหรับ mock

`GET /api/me` สำหรับผู้ใช้ใหม่

~~~json
{"user":{"id":"usr_demo"},"avatar":null}
~~~

`PUT /api/me/avatar` ทั้ง request และ response shape เดียวกัน ส่วน response ของ `GET /api/me` ใส่ object นี้ใน `avatar`

~~~json
{"displayName":"Mook","preset":"matcha"}
~~~

ตัดช่องว่างหัวท้ายของชื่อ ตรวจ 1–16 Unicode code points และปฏิเสธ control characters ค่า `preset` รับ `strawberry` หรือ `matcha` ใช้ `user.id` จาก session เสมอ

`POST /api/rooms/study-room/join`

~~~json
{"attemptId":"7639db4e-0c1b-4c77-9b7f-a3c0d787da12"}
~~~

~~~json
{
  "roomId":"study-room",
  "gameRoomId":"AbcdEF012",
  "gameWsUrl":"ws://localhost:2567",
  "joinTicket":"mock-ticket",
  "expiresAt":"2030-01-01T00:00:45.000Z"
}
~~~

ตัวอย่าง validation error

~~~json
{
  "error":{
    "code":"validation_error",
    "message":"Enter a display name (1–16 characters).",
    "fields":{"displayName":"length"}
  }
}
~~~

Responses ที่ไม่มี field error ให้ละ `fields` UI ตัดสินด้วย `code` และ map เป็นข้อความของตัวเอง ใช้ `error.message` ช่วยตอน debug โดยไม่ส่ง stack trace ให้ผู้ใช้

## Join, seat และ reconnect

1. Web สร้าง `attemptId` ต่อการกด Walk in และกันการกดซ้ำขณะรอ API ตรวจ session กับ avatar แล้วอ่าน `gameRoomId` จาก `GET /internal/room` ของ Game ผ่าน private network ถ้าห้องพร้อมจึงออก join ticket อายุร่าง 45 วินาที
2. ตั๋วเซ็นด้วย secret แยกจาก auth/LiveKit ใช้ algorithm ที่กำหนดตายตัว ตรวจ issuer, audience, expiry และผูกทั้ง logical room ID กับ `gameRoomId` ของ instance ปัจจุบัน Payload มี `sub` (บัญชี), `jti` (nonce), `attemptId` และ snapshot ของ avatar ส่งตั๋วใน payload ของ SDK ผ่าน HTTPS/WSS เก็บใน browser memory และหลีกเลี่ยง URL query หรือ logs
3. Game สร้าง room instance เดียวตอนเริ่มและเก็บห้องไว้แม้ไม่มีคน Web ใช้ `joinById(gameRoomId, { joinTicket })` เพื่อ join instance เดียวกับที่ API เห็น การหาห้องหรือจองที่นั่งล้มเหลวต้องไม่สร้างห้องเพิ่ม ถ้า Game ยังไม่พร้อมให้คืน `room_unavailable`
4. Game ตรวจตั๋วและจองที่นั่งใน Game process เดียว เช็กที่นั่ง active + reserved รวมกับบัญชีที่กำลัง reconnect เพื่อกัน race เมื่อเหลือที่เดียว ตั๋วที่ Game รับแล้วใช้ซ้ำไม่ได้ภายในอายุของตั๋ว ถ้า seat handshake ไม่เสร็จให้คืนที่นั่งตาม timeout
5. Game กันบัญชีที่มีที่นั่งอยู่แล้วด้วย `already_in_room` ให้ผู้ใช้กลับแท็บเดิมหรือรอที่นั่งหมดอายุ Web บันทึก `room_ready` เมื่อได้ initial state, พบ local player, โหลด scene และเปิด input แล้ว
6. ถ้า network หลุด ให้ SDK ใช้ reconnection token ใน memory ในหน้าต่าง 20 วินาที Game คง seat และ state ของตัวละครตามแนวทาง Colyseus ระหว่างนี้หยุด input และถอด voice client เมื่อ restore แล้วใช้ snapshot ล่าสุดและเริ่มเสียงใหม่โดยไมค์ปิด
7. เมื่อหมดเวลา, reload หรือ Game restart ให้ขอตั๋วใหม่ด้วย session ปัจจุบันและสร้าง player instance ใหม่ ถ้า Leave ให้ปิด input/voice, ปิด connection, คืน seat และไป Discover Cleanup ทำซ้ำได้ทั้งกรณี user กด Leave และ timeout

Game error ที่ client normalize ใช้ `room_full`, `already_in_room`, `ticket_invalid`, `ticket_expired` และ `room_unavailable` กรณี ticket หมดอายุให้ขอตั๋วใหม่หนึ่งครั้งภายใน attempt เดิม ส่วน join หรือ reconnect ที่ผู้ใช้กดใหม่เป็น attempt ใหม่

Session cookie กับ join ticket มีอายุคนละชุด หลัง sign out API จะไม่ออกตั๋วใหม่ ตั๋วที่ออกแล้วหมดสิทธิ์เมื่อถูกใช้หรือหมดอายุ อีกแท็บที่ถือ connection อยู่ต้องออกห้องหรือหมดเวลา reconnect การตัดทุก connection ทันทีเมื่อถอน session เป็นงานต่อยอด

[Colyseus reconnection](https://docs.colyseus.io/room/reconnection)

## Game state และข้อความ

ใช้ [realtime schemas](../../packages/shared/src/realtime.ts) สำหรับตรวจ payload ในขั้นเชื่อมต่อ `voice.request` และ `voice.unavailable` เป็นข้อความที่ไม่มี payload

| ทิศทาง | ข้อความหรือ state | ความหมาย |
| --- | --- | --- |
| Game → Web | Snapshot + patches ของ players | key เป็น Colyseus session ID มี `displayName`, `preset`, `x`, `z`, `heading`, `moving` และ `lastMoveSeq` เพิ่ม/ลบใน collection เพื่อแสดง join/leave |
| Web → Game | `move` พร้อม `seq`, `x`, `z` | ใช้รูปแบบส่ง predicted position ตาม V1 เริ่มที่ประมาณ 15 Hz Game ตรวจลำดับ, ระยะที่เดินได้, path/collision และส่ง accepted seq กลับ |
| Web → Game | `voice.request` | ขอตั๋ว LiveKit สำหรับ connection ที่เข้า room แล้ว |
| Game → Web | `voice.granted` พร้อม `url`, `token` หรือ `voice.unavailable` | ตอบเฉพาะผู้ขอ ผู้เล่นคนอื่นไม่เห็น token |
| Colyseus transport | Join, disconnect, reconnect และ explicit leave | ใช้ lifecycle ของ SDK แล้วแปลงเป็นสถานะ UI |

เดินด้วยคีย์บอร์ดหรือคลิกพื้น Client ใช้ map และ collision rules ชุดเดียวกับ Game เพื่อหาและตรวจเส้นทาง Game ตรวจผลทีละช่วงสั้น ๆ เพื่อกันทะลุผนังเมื่อ frame ช้า Client interpolate ผู้เล่นอื่นและ reconcile ของตัวเองจาก `lastMoveSeq`

## Voice หลัง Game join

- ใช้ session ID ของ Colyseus เป็น LiveKit participant identity ภายในห้องนั้น ให้ Game เซ็น token อายุร่าง 2 นาที จำกัด room, subscribe และ publish เฉพาะ microphone ส่ง token เฉพาะหลังผู้ขออยู่ใน room
- เมื่อ room พร้อม ให้ Web ต่อเสียงแบบรับฟังด้วยไมค์ปิด เปิดไมค์เมื่อผู้ใช้กดและ browser ให้ permission หาก autoplay ถูกบล็อก ให้แสดงทางเปิดเสียงด้วยการกดจากผู้ใช้
- เมื่อตำแหน่งอัปเดต ให้ Web ใช้ Game state จับคู่ audio track ตาม identity ลดระดับตามระยะและให้ volume เป็นศูนย์นอกระยะ กลไกนี้ควบคุมการนำเสนอเสียงใน client ปกติ จุดประสงค์คือวงสนทนาตามระยะในห้องเดียว
- Leave/หมดเวลาให้ Client ปิด track และ disconnect Game จัดการลบ participant เดิมผ่าน LiveKit best effort และไม่ออก token ใหม่ให้ connection ที่ออกแล้ว เนื่องจาก self-hosted token ที่หลุดออกไปอาจถูกใช้ได้จนหมดอายุ ให้ใช้ TTL สั้นและห้ามบันทึก token
- ถ้าเสียงล้มเหลว ให้ยังเดินได้และให้ลองใหม่ เมื่อ reconnect ให้เริ่มใหม่ด้วยไมค์ปิดตาม flow ของ UI ถ้าใช้ participant ID เดิม ให้รอ cleanup เดิมจบก่อนออก token ใหม่ เพื่อให้คำสั่งลบ participant ไม่ชนกับการเข้าใหม่

[LiveKit access tokens and grants](https://docs.livekit.io/frontends/reference/tokens-grants/)

## สถานะที่ใช้ทำ UI mock

| สถานะ | สัญญาณ | UI |
| --- | --- | --- |
| Sign in required | `GET /api/me` ตอบ `401` | แสดง Sign in |
| Character required | `avatar: null` หรือ `avatar_required` | เปิด Create Character |
| Character save failed | validation หรือ service unavailable | แสดง field error หรือ retry โดยคงข้อมูลที่กรอก |
| Joining / room full / unavailable | request pending หรือ Game error | รอใน Discover หรือแสดงเหตุผลให้ retry |
| Room ready / disconnected | snapshot พร้อมหรือ connection หลุด | เปิดเดิน หรือเปิดแผง Reconnect และหยุด input |
| Mic denied / voice unavailable | browser permission หรือ LiveKit error | แสดงวิธีแก้และให้ใช้งานห้องต่อ |
