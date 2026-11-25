# Database และเจ้าของข้อมูล

PostgreSQL 17 เป็น source of truth ของบัญชี session และตัวละคร ให้ NestJS API ใช้ Prisma 7 เป็นเจ้าของการเข้าถึงข้อมูลระหว่างทำงาน ส่วน Game รับ snapshot ของ avatar จากตั๋วเข้าห้อง

~~~mermaid
erDiagram
    AUTH_USER ||--o{ AUTH_ACCOUNT : links
    AUTH_USER ||--o{ AUTH_SESSION : has
    AUTH_USER ||--o| AVATAR : owns
    AVATAR {
        text user_id PK, FK
        text display_name
        text preset
        timestamptz created_at
        timestamptz updated_at
    }
~~~

## ตารางและ constraints

| ข้อมูล | เจ้าของ schema | กฎ |
| --- | --- | --- |
| User, account, session และตาราง auth ที่ adapter ต้องใช้ | Better Auth + Prisma adapter | ใช้โมเดล Better Auth ใน Prisma schema ล็อก unique/index ใน migration ID ของ Auth สร้างผ่าน UUID generator ใน config |
| `avatars` | Mini Connecta ผ่าน Prisma | `user_id` เป็น PK/FK ไป user ด้วย type เดียวกับ auth schema และ `ON DELETE CASCADE` |
| `avatars.display_name` | Mini Connecta | `NOT NULL`, ตรวจความยาว 1–16 หลัง trim ใน API และใช้ DB check สำหรับความยาวที่เก็บ |
| `avatars.preset` | Mini Connecta | `NOT NULL`, check ให้เป็น `strawberry` หรือ `matcha` |
| `created_at`, `updated_at` | Mini Connecta | `timestamptz`, default ของแถวใหม่เป็นเวลาปัจจุบัน อัปเดต `updated_at` เมื่อเปลี่ยนค่าจริง |

ใช้ logical names ในแผนภาพ ชื่อ physical tables ของ Better Auth ให้ยึด generated schema บัญชี Google เชื่อมด้วย provider identity ตาม Better Auth UI ใช้ display name ของ avatar ได้โดยชื่อซ้ำกัน ผู้เล่นคนอื่นเห็น display name และ preset ผ่าน Game state

### การอ่านและเขียนที่ต้องรองรับ

- `GET /api/me` ตรวจ session แล้วอ่าน avatar ด้วย PK ของ `user_id` ผู้ใช้ใหม่ยังไม่มีแถวและได้ `avatar: null`
- `PUT /api/me/avatar` ใช้ upsert ใน statement เดียวตาม `user_id` ให้บันทึกซ้ำด้วยค่าเดิมแล้วเหลือหนึ่งแถวและคง `created_at` หาก request สองค่ามาถึงใกล้กัน ผลสุดท้ายเป็นแถวที่เขียนสำเร็จล่าสุด UI กันการกดซ้ำระหว่างบันทึก
- ตอนออก join ticket API อ่าน avatar ล่าสุดแล้วใส่เฉพาะ field สาธารณะใน snapshot การเปลี่ยน avatar จะมีผลในห้องเมื่อ join ใหม่
- ให้ auth library อ่าน session และ lookup provider ใช้ constraint/index ที่ schema ประกาศอยู่แล้ว เพิ่ม index เมื่อพบ query จริงที่จำเป็นจาก EXPLAIN หรือผลเทส

## ข้อมูลชั่วคราวและ config

| ข้อมูล | ที่อยู่ | เมื่อ restart |
| --- | --- | --- |
| `study-room`, `cosy-library`, capacity และ preset catalog | Config กับ shared package | โหลดใหม่จาก release เดิม |
| ตำแหน่ง, player presence, seat, used join ticket nonce, reconnect token | Game memory และ client memory เท่าที่จำเป็น | Game restart แล้ว client ขอ join ticket ใหม่ |
| Track, participant และระดับเสียงตามระยะ | LiveKit และ browser | ต่อเสียงใหม่ด้วยไมค์ปิด |
| Telemetry dedup state | API memory แบบ TTL | เริ่ม window ใหม่และดู coverage ตาม [Observability](observability.md) |

## Migration และ backup

1. Generate Prisma models ของ Better Auth จาก config ที่ใช้จริง แล้วรวมกับ model ของแอปใน Prisma schema เดียว ใช้ `prisma migrate dev` ใน local และตรวจ migration SQL ก่อน commit หากต้องเพิ่ม DB check ที่กำหนดไว้ ให้ใส่ใน migration SQL และทดสอบ constraint โดยตรง
2. ลอง migrate จาก DB ว่างและ DB ที่มี session/avatar fixture ตรวจ unique, FK และ upsert ซ้ำ เก็บ migration เป็น versioned files
3. ให้ migration job รัน `prisma migrate deploy` หนึ่งครั้งก่อนเปิด API รุ่นใหม่ ใช้ role สำหรับ schema แยกจาก role ของ API เมื่อ release ใช้ข้อมูลจริง ทดสอบบน volume ชั่วคราวก่อนใช้กับข้อมูล playtest
4. ใช้ `pg_dump` แบบ custom format เก็บนอก VM บน storage ที่คณะอนุญาตแบบจำกัดสิทธิ์และเข้ารหัส ดูตารางสำรองและการกู้ใน [Deployment](deployment.md) กู้ลง DB แยกแล้วตรวจว่า schema กับ avatar เปิดได้โดยใช้ release ที่ตรงกัน
5. จำกัดสิทธิ์อ่าน DB และ backup ให้กับผู้ดูแล เก็บ auth-related columns เป็นข้อมูลลับ หลีกเลี่ยงการเก็บวันเกิดและอีเมลซ้ำในตาราง avatar ตรวจ behavior ของ OAuth adapter และอย่าขอสิทธิ์ Google เพิ่มเพื่อใช้ในห้อง

[Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
