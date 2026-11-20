# สรุป Architecture ของ Mini Connecta

สถานะ **ข้อ 3.2** · เว็บ Next.js ใช้ข้อมูลจำลองในเบราว์เซอร์ ห้องใช้ภาพฉากจาก Demo UI

หน้าใน `apps/web/src/app` ประกอบ UI ส่วนพฤติกรรมและสถานะอยู่ใน `apps/web/src/features` เส้นทางหลักคือ `/login` → `/character` → `/discover` → `/rooms/study-room` ผู้ใช้ที่มีตัวละครแล้วไป Discover ได้เลย

**การอัปเดต** ตั้งแต่ข้อ 3.3 ให้แก้หน้านี้ในงานเดียวกันเมื่อเพิ่ม ย้าย ลบไฟล์ หรือเปลี่ยนหน้าที่ของไฟล์ ใช้หนึ่งบรรทัดต่อไฟล์ [แผนงาน](plan.md) · [แบบระบบ](02-system-design/README.md)

## `apps/web/src`

| ไฟล์ | หน้าที่ |
| --- | --- |
| [app/layout.tsx](../apps/web/src/app/layout.tsx) | ครอบทุกหน้า ตั้ง metadata และโหลด CSS กลาง |
| [app/globals.css](../apps/web/src/app/globals.css) | กำหนดสี ฟอนต์ ธีม และ layout สำหรับจอเล็กและใหญ่ |
| [app/page.tsx](../apps/web/src/app/page.tsx) | พา `/` ไป `/login` |
| [app/login/page.tsx](../apps/web/src/app/login/page.tsx) | ประกอบหน้า Sign in |
| [app/character/page.tsx](../apps/web/src/app/character/page.tsx) | ประกอบหน้าสร้างตัวละคร |
| [app/discover/page.tsx](../apps/web/src/app/discover/page.tsx) | เปิดหน้า Discover |
| [app/rooms/study-room/page.tsx](../apps/web/src/app/rooms/study-room/page.tsx) | เปิดหน้า Study Room |
| [components/BrandMark.tsx](../apps/web/src/components/BrandMark.tsx) | โลโก้ที่ใช้ร่วมกันในหน้า Auth และ Discover |
| [features/auth/AuthLayout.tsx](../apps/web/src/features/auth/AuthLayout.tsx) | โครงหน้าร่วมของ Sign in และ Create Character |
| [features/auth/SignIn.tsx](../apps/web/src/features/auth/SignIn.tsx) | ปุ่ม Google Sign-in จำลองและสถานะรอ ยกเลิก หรือผิดพลาด |
| [features/auth/preview-account.ts](../apps/web/src/features/auth/preview-account.ts) | เก็บสถานะ Sign in จำลองและพาไปหน้าที่ตรงกับบัญชีและสถานะห้อง |
| [features/avatar/CharacterForm.tsx](../apps/web/src/features/avatar/CharacterForm.tsx) | กรอกชื่อ เลือก preset พรีวิว และบันทึกตัวละคร |
| [features/avatar/presets.ts](../apps/web/src/features/avatar/presets.ts) | รายการ preset รูปตัวละคร และ types ของตัวละคร |
| [features/avatar/preview-avatar.ts](../apps/web/src/features/avatar/preview-avatar.ts) | อ่าน ตรวจรูปแบบ และบันทึกตัวละครใน localStorage |
| [features/discover/Discover.tsx](../apps/web/src/features/discover/Discover.tsx) | แสดง Common Study Room หนึ่งใบ สถานะว่างของ Open rooms และปุ่ม Walk in |
| [features/room/StudyRoom.tsx](../apps/web/src/features/room/StudyRoom.tsx) | แสดงภาพฉากและจำลองสถานะไมค์ การเชื่อมต่อ และ Leave |
| [features/room/RoomHud.tsx](../apps/web/src/features/room/RoomHud.tsx) | แสดงชื่อห้อง ปุ่ม Leave และแถบผู้เล่นจำลอง |
| [features/room/preview-room.ts](../apps/web/src/features/room/preview-room.ts) | อ่าน ตั้ง และล้างสถานะเข้าห้องใน sessionStorage ของแท็บ |
| [features/preview/browser-storage.ts](../apps/web/src/features/preview/browser-storage.ts) | อ่านเขียน browser storage และแจ้งหน้าจอเมื่อค่าเปลี่ยน |
| [features/preview/PreviewTheme.tsx](../apps/web/src/features/preview/PreviewTheme.tsx) | จัดธีม light, dark และ system และจดค่าที่เลือก |
| [features/preview/PreviewControls.tsx](../apps/web/src/features/preview/PreviewControls.tsx) | แผงเลือกธีมและจำลองเหตุการณ์ของแต่ละหน้า |
| [features/preview/use-preview-action.ts](../apps/web/src/features/preview/use-preview-action.ts) | จัดสถานะรอและยกเลิก timer ของงานจำลอง |

## Workspace และ assets

| ไฟล์หรือโฟลเดอร์ | หน้าที่ |
| --- | --- |
| [package.json](../package.json) | กำหนด Node.js และ pnpm ของ workspace |
| [pnpm-workspace.yaml](../pnpm-workspace.yaml) | รวม package ใต้ `apps` และ `packages` |
| [pnpm-lock.yaml](../pnpm-lock.yaml) | ล็อกเวอร์ชัน dependencies |
| [.npmrc](../.npmrc) | ตั้ง pnpm แบบ hoisted สำหรับแชร์ dependency ใน workspace |
| [.gitignore](../.gitignore) | ระบุไฟล์ env และผล build ที่เป็นของเครื่องพัฒนา |
| [apps/web/package.json](../apps/web/package.json) | dependencies และคำสั่ง dev, build, start, typecheck |
| [apps/web/tsconfig.json](../apps/web/tsconfig.json) | ตั้ง TypeScript เคร่งครัดและ alias `@/` |
| [apps/web/next-env.d.ts](../apps/web/next-env.d.ts) | ไฟล์ types ที่ Next.js สร้างให้ |
| [apps/web/public/assets](../apps/web/public/assets) | ฟอนต์ Nunito, ภาพปก Library, รูปสอง preset และภาพห้องสำหรับเดสก์ท็อปกับมือถือ |
| [apps/api/package.json](../apps/api/package.json) | จอง package สำหรับ REST API |
| [apps/game/package.json](../apps/game/package.json) | จอง package สำหรับ Colyseus |
| [packages/shared/package.json](../packages/shared/package.json) | จอง package สำหรับ types และ schema ที่ใช้ร่วมกัน |
| [packages/db/package.json](../packages/db/package.json) | จอง package สำหรับ Prisma และ migrations |

## `demo ui`

ต้นแบบ HTML ที่ใช้เทียบหน้าตาของ Next.js [วิธีรัน](../demo%20ui/README.md)

| ไฟล์หรือโฟลเดอร์ | หน้าที่ |
| --- | --- |
| [index.html](../demo%20ui/index.html) | หน้า Sign in ของต้นแบบ |
| [login-character.html](../demo%20ui/login-character.html) | หน้าตั้งชื่อและเลือกตัวละคร |
| [discover.html](../demo%20ui/discover.html) | หน้า Discover สำหรับลองการเข้าห้อง |
| [walk-library.html](../demo%20ui/walk-library.html) | หน้าภาพฉากและ HUD ของ Study Room |
| [serve.mjs](../demo%20ui/serve.mjs) | เปิด static preview บนพอร์ต 3210 |
| [assets/mini-connecta.css](../demo%20ui/assets/mini-connecta.css) | CSS ต้นแบบของแต่ละหน้า |
| [assets/preview.js](../demo%20ui/assets/preview.js) | จำลอง flow, ธีม และสถานะผิดพลาดของหน้า HTML |
| [assets](../demo%20ui/assets) | ภาพประกอบ ภาพแคป รูปตัวละคร และฟอนต์จากต้นแบบ |

## ข้อมูลที่เก็บในเบราว์เซอร์

เว็บ Next.js ใช้ [browser-storage.ts](../apps/web/src/features/preview/browser-storage.ts) อ่านเขียนข้อมูลจำลอง โดยเติมคำนำหน้า `mini-connecta:` ให้ทุก key

| Key | ที่เก็บ | ค่าและหน้าที่ | ไฟล์ที่ดูแล |
| --- | --- | --- | --- |
| `mini-connecta:signed-in` | `localStorage` | ข้อความ `'true'` เมื่อ Sign in จำลองสำเร็จ ลบเมื่อกด Sign out | [preview-account.ts](../apps/web/src/features/auth/preview-account.ts) |
| `mini-connecta:profile` | `localStorage` | JSON ของชื่อและ preset ในรูป `{ name, preset }` ใช้ข้ามหน้าสร้างตัวละครเมื่อกลับมา Sign in | [preview-avatar.ts](../apps/web/src/features/avatar/preview-avatar.ts) |
| `mini-connecta:theme` | `localStorage` | ค่าธีม `system`, `light` หรือ `dark` แบบ JSON | [PreviewTheme.tsx](../apps/web/src/features/preview/PreviewTheme.tsx) |
| `mini-connecta:joined-study-room` | `sessionStorage` | ข้อความ `'true'` หลัง Walk in สำเร็จในแท็บนั้น รีเฟรชแล้วยังอยู่ได้ ลบเมื่อ Leave หรือ Sign out | [preview-room.ts](../apps/web/src/features/room/preview-room.ts) |

สถานะไมค์ การเชื่อมต่อ และตัวเลือกจำลองข้อผิดพลาดอยู่ใน state ของหน้า

**Cookie สำหรับระบบจริง** วางไว้ในข้อ 4.2 ให้ Better Auth ใช้ session cookie แบบ `HttpOnly` และ `Secure` เมื่อใช้ HTTPS ฝั่ง NestJS จะตรวจ session ก่อนอนุญาตให้ใช้งาน API ที่ต้องล็อกอิน [แบบ API และ Auth](02-system-design/backend-api.md)
