# Observability และแผนวัดผล

เอกสารนี้กำหนดสิ่งที่ต้องเพิ่มในขั้น 4 เพื่อใช้ตรวจระบบและทดสอบโหลดในขั้น 5 ใช้ข้อมูลบน VM สำหรับ smoke และ playtest ตาม [แผน](../plan.md)

## SLO เริ่มต้น

| SLO | SLI และช่วงเวลา | เป้า |
| --- | --- | --- |
| Join ticket availability | สัดส่วนคำขอตั๋วเข้าห้องที่ status ต่ำกว่า 500 ตลอด 30 วัน | ≥ 99.5% |
| Join ticket latency | สัดส่วนคำขอตั๋วเข้าห้องที่ API ตอบภายใน 300 ms ตลอด 30 วัน | ≥ 99% |
| Join ready | สัดส่วน eligible join attempts ที่เริ่มเดินได้ภายใน 5 วินาที ตลอด 30 วัน | ≥ 99% |
| Mic publish | สัดส่วนครั้งที่ LiveKit รับไมค์ภายใน 5 วินาที นับหลังได้สิทธิ์ไมค์ ตลอด 30 วัน | ≥ 99% |

HTTP metrics ใช้กับ `POST /api/rooms/study-room/join` เวลาที่ API ล่มจนรับ request ไม่ได้ดูประกอบกับ scrape, edge probes หรือ synthetic checks

Join เริ่มเมื่อกด Walk in และจบเมื่อ Colyseus snapshot กับ scene พร้อมและเปิด input แล้วแยก `room_full`, `already_in_room`, กรณีไม่มี session หรือ avatar และการยกเลิกชัดเจนออกจาก denominator ส่วน network/server error และ timeout ของ request ที่มีสิทธิ์นับเป็น fail

Voice มีสองผลต่อรอบใช้งาน `voice_connect` วัดตั้งแต่ขอ Voice grant จนต่อ LiveKit ได้ แม้ไมค์ยังปิด ส่วน `voice` วัดตั้งแต่เบราว์เซอร์เปิดไมค์ได้จน publish track สำเร็จ ผลยกเลิกเพราะออกจากห้องแยกจากความล้มเหลว E2E สองเบราว์เซอร์ตรวจว่าอีกฝั่งได้รับ audio track และระดับเสียงเปลี่ยนตามระยะ การได้ยินจากลำโพงจริงตรวจด้วยสองเครื่อง

## จุดเก็บข้อมูลและการนับหนึ่งครั้งต่อ attempt

ใช้ `performance.now()` ใน browser สำหรับเวลาใน attempt เดียว ส่วน server ใช้ monotonic timer ของตัวเอง ในทุก chart แสดง sample count และ error rate คู่กับ p95

| Event | จุดเริ่มหรือจบ | เจ้าของ |
| --- | --- | --- |
| `join_started` | กด Walk in ก่อนเรียก API | Browser |
| `room_ready` หรือ `join_failed` | เดินได้ หรือ flow จบด้วย error/timeout | Browser |
| `voice_connect` | ขอ Voice grant แล้วเชื่อม LiveKit | Browser |
| `voice` | publish ไมค์หลังได้รับสิทธิ์ | Browser |
| Game reconnect | เริ่มต่อใหม่, กลับสำเร็จ หรือหมดเวลา | ตัวนับเดิมของ Colyseus ฝั่ง Game Server |
| `join_ticket_issued`, `seat_reserved`, `game_joined` | ขั้น API/Colyseus สำหรับหาว่าช้าหรือล้มที่ใด | API และ Game |

### Browser → API telemetry

ส่ง start/finish แบบ best effort ผ่าน `POST /api/telemetry/room-attempts` ด้วย same-origin cookie ตรวจชนิด, UUID และค่าตาราง outcome ตาม [API contract](backend-api.md) กดใหม่หลัง flow จบใช้ UUID ใหม่ ส่วน retry ภายใน หรือส่ง telemetry ซ้ำ คง UUID เดิมและไม่เปิด attempt ใหม่ จำกัดขนาด request และ rate limit ต่อ session

~~~json
{"phase":"start","kind":"join","attemptId":"7639db4e-0c1b-4c77-9b7f-a3c0d787da12"}
~~~

~~~json
{
  "phase":"finish",
  "kind":"join",
  "attemptId":"7639db4e-0c1b-4c77-9b7f-a3c0d787da12",
  "outcome":"success",
  "durationMs":920
}
~~~

`kind` รองรับ `join`, `voice_connect` และ `voice` และ `outcome` รับ enum จำกัดตามประเภท เช่น `success`, `room_full`, `already_in_room`, `auth_required`, `avatar_required`, `cancelled`, `timeout` และ `failed` Backend normalize ก่อนบันทึก ชุด outcome ที่ถูก exclude แสดงเป็น counter แยก

- เก็บ dedup ใน API memory ตาม `session + kind + attemptId` นานร่าง 10 นาที ให้ start/finish มาสลับลำดับได้ เขียน metric terminal เพียงครั้งเดียวและรับ duplicate ด้วย `204`
- ตั้งเวลา flow timeout ร่าง 15 วินาที และให้ API mark start ที่ยังไม่จบหลัง 30 วินาทีเป็น `missing_result` แสดงเป็น attempt ที่ยังวัดความสำเร็จไม่ได้ เมื่อสรุปผลใช้จำนวนนั้นเป็น non-good สำหรับ attempts ที่ API รับไว้ เพื่อไม่ให้ตัวเลขดีขึ้นจากข้อมูลหาย
- ถ้าไม่มี start และ finish ถึง API เลย ให้สังเกตจาก synthetic test และเปรียบเทียบจำนวน Game/API events กับ client volume ระบุ coverage และการ reset ตอน API restart ไว้ในผลเทส
- ห้ามใช้ `attemptId`, `userId`, session ID, token, raw URL, ชื่อ หรืออีเมลเป็น Prometheus label ใช้ route template, service, phase และ outcome enum

## Dashboard, metrics และ alert

| กลุ่ม | Metrics เริ่มต้น | แสดงผล |
| --- | --- | --- |
| API | `mini_http_requests_total`, `mini_http_request_duration_seconds` ขอบ bucket ที่ `0.3` | Rate, 5xx, latency และ วัดเฉพาะ API ขอตั๋วเข้าห้อง |
| Join และ Voice | `mini_room_attempts_total{kind,outcome}`, `mini_room_attempt_duration_seconds{kind,outcome}` ขอบ bucket ที่ `5` | Success ภายใน target, p95, error reason, sample count และ missing result |
| Game | `mini_game_players`, `mini_game_seats_reserved`, `mini_game_tick_duration_seconds` และ reconnect counters | จำนวนคน, seat ค้าง, tick time และอัตรากลับเข้าห้อง |
| LiveKit และเครื่อง | RTC participant/track metrics ที่เวอร์ชันรองรับ, CPU/RAM, disk, network, DB connections | จำนวน track, capacity, bandwidth และ resource contention |

**Study Room Overview** มีสามแผง Join และ Voice ใช้ช่วงคำนวณย้อนหลัง 5 นาที

- Join แสดงจำนวน eligible attempts, ครั้งที่ห้องเต็ม และสัดส่วนที่เข้าแล้วเดินได้ภายใน 5 วินาที
- Voice แสดงจำนวนและสัดส่วนที่ต่อ LiveKit สำเร็จ รวมถึงจำนวนและสัดส่วนที่ publish ไมค์สำเร็จ แยกกันด้วย `kind`
- Reconnect ใช้ `mini_game_reconnect_total` แสดงยอดเกมหลุด กลับสำเร็จ และหมดเวลาสะสมตั้งแต่ Game Server เริ่มรัน การกด Leave ตามปกติไม่เข้าตัวนับนี้

Dashboard **Study Room Diagnostics** แสดง HTTP status และ p95 ของ API ขอตั๋ว ผล Join/Voice, ผู้เล่น, ที่นั่ง, game tick, LiveKit, ทรัพยากร และ scrape status

ใช้ Prometheus scrape บริการและให้ Grafana อ่าน metrics ดู structured logs แยกตามบริการด้วย `docker compose logs` โดย Docker หมุนไฟล์ log ตามขนาด ใส่ request ID หรือ attempt ID เฉพาะ log ที่ทีมมีสิทธิ์ดู และหลีกเลี่ยง cookie, OAuth code, token, ชื่อ และอีเมล

เริ่ม Alertmanager ด้วยกฎตรวจ service down เกิน 1 นาที, Join/Voice failure ต่อเนื่องเมื่อมีอย่างน้อย 10 ตัวอย่างใน 5 นาที และ disk เหลือต่ำกว่า 20% ต่อเนื่อง 10 นาที ค่า threshold ใช้เป็นร่างแล้วปรับจาก baseline ตรวจว่า alert fire และ resolve จริงใน local ก่อนใช้กับ playtest

[V1 Observability, SLO และ drills](../../../Project-StudyRoom3d/infra/observability/README.md)

## Checklist สำหรับขั้น 5

1. บันทึกสเปกเครื่อง การจำกัด CPU/RAM ของ containers และ version ของ stack เริ่ม baseline ด้วยสอง browser/สองผู้ใช้ วัดเดิน, Join, Voice, FPS และเสียงที่ได้ยินจริง
2. แยกทดสอบ HTTP ด้วย k6, Game movement ด้วย Colyseus bots และ LiveKit publish/subscribe ด้วย LiveKit CLI ที่ 5, 10, 20 และ 30 คน ให้ capacity ใน test profile รองรับระดับที่วัด แล้วลอง flow รวมที่ 20 คน เก็บจำนวน publisher/subscriber ด้วย
3. ซ้อม API/DB หยุด, Game restart, LiveKit หยุด, network drop และ disk pressure แบบควบคุมใน local ดูว่า UI, dashboard และ alert สื่ออาการตรงกัน ตรวจผลหลังบริการกลับมาและลอง restore/rollback ตาม [Deployment](deployment.md)
4. สรุปผลเป็นจำนวน concurrent users, ระยะเวลารัน, จำนวนตัวอย่าง, eligible/good/failed/missing, p95, resource peak และคอขวด รายงานทั้งสามส่วนแยกกันและรอบรวม
5. ใช้โหลดสูงสุดที่ยังผ่านเกณฑ์เพื่อเลือกรอบ playtest เป้าเริ่มต้น 15–20 คน ผล local บอกความจุใน local เท่านั้น และตัวเลขจากรอบสั้นใช้ประเมินเป้าร่างก่อนเก็บ 30 วัน

[LiveKit load testing](https://docs.livekit.io/reference/developer-tools/livekit-cli/perf/)
