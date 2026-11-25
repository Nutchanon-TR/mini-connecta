# สรุป Architecture ของ Mini Connecta

เว็บรัน mock ได้เอง โหมดจริงผ่าน Caddy ไป NestJS, PostgreSQL, Colyseus และ LiveKit

หน้าใน `apps/web/src/app` ประกอบ UI ส่วนพฤติกรรมและสถานะอยู่ใน `apps/web/src/features` เส้นทางหลักคือ `/` (Landing) → `/login` → `/character` → `/discover` → `/rooms/study-room` ผู้ใช้ที่มีตัวละครแล้วไป Discover ได้เลย

**การอัปเดต** ตั้งแต่ข้อ 3.3 ให้แก้หน้านี้ในงานเดียวกันเมื่อเพิ่ม ย้าย ลบไฟล์ หรือเปลี่ยนหน้าที่ของไฟล์ ใช้หนึ่งบรรทัดต่อไฟล์ [แผนงาน](plan.md) · [แบบระบบ](02-system-design/README.md)

## `apps/web/src`

| ไฟล์ | หน้าที่ |
| --- | --- |
| [app/layout.tsx](../apps/web/src/app/layout.tsx) | ครอบทุกหน้า ตั้ง metadata และโหลด CSS กลาง |
| [app/globals.css](../apps/web/src/app/globals.css) | กำหนดสี ฟอนต์ ธีม และ layout สำหรับจอเล็กและใหญ่ |
| [app/shell.css](../apps/web/src/app/shell.css) | จัดหน้าตา Landing, Login, Discover และเมนูบัญชี |
| [app/page.tsx](../apps/web/src/app/page.tsx) | Landing สาธารณะที่พาไป Login หรือ Discover |
| [app/login/page.tsx](../apps/web/src/app/login/page.tsx) | ประกอบหน้า Sign in |
| [app/character/page.tsx](../apps/web/src/app/character/page.tsx) | ประกอบหน้าสร้างตัวละคร |
| [app/character/edit/page.tsx](../apps/web/src/app/character/edit/page.tsx) | เปิดฟอร์มแก้ชื่อและ preset ของผู้ใช้ที่ล็อกอินแล้ว |
| [app/discover/page.tsx](../apps/web/src/app/discover/page.tsx) | เปิดหน้า Discover |
| [app/rooms/study-room/page.tsx](../apps/web/src/app/rooms/study-room/page.tsx) | เปิดหน้า Study Room |
| [components/BrandMark.tsx](../apps/web/src/components/BrandMark.tsx) | โลโก้ที่ใช้ร่วมกันในหน้า Landing, Auth และ Discover |
| [lib/api.types.ts](../apps/web/src/lib/api.types.ts) | Types ของ REST endpoints ที่ generate จาก OpenAPI |
| [lib/api.ts](../apps/web/src/lib/api.ts) | Typed client กลาง เลือก mock หรือ network และแปลง HTTP errors |
| [lib/api-mode.ts](../apps/web/src/lib/api-mode.ts) | อ่าน `NEXT_PUBLIC_API_MODE` สำหรับเลือก mock หรือการเชื่อมต่อจริงทั้ง REST, Game และ Voice |
| [lib/mock-api.ts](../apps/web/src/lib/mock-api.ts) | ตอบ REST routes ด้วย DTO, status และ error ตาม OpenAPI |
| [features/auth/api.ts](../apps/web/src/features/auth/api.ts) | อ่านบัญชีและแปลงผลเป็นสถานะ Sign in หรือ Create Character |
| [features/auth/AuthLayout.tsx](../apps/web/src/features/auth/AuthLayout.tsx) | โครงหน้าร่วมของ Sign in และ Create Character |
| [features/auth/SignIn.tsx](../apps/web/src/features/auth/SignIn.tsx) | ปุ่ม Google Sign-in และ Continue as guest สำหรับ Better Auth และ mock |
| [features/auth/auth-client.ts](../apps/web/src/features/auth/auth-client.ts) | สร้าง Better Auth client ฝั่งเว็บ |
| [features/auth/preview-account.ts](../apps/web/src/features/auth/preview-account.ts) | โหลดบัญชีผ่าน API, route guard และจัด mock sign-in/sign-out |
| [features/auth/AccountUnavailable.tsx](../apps/web/src/features/auth/AccountUnavailable.tsx) | ข้อความและปุ่ม Retry เมื่อตรวจบัญชีไม่สำเร็จ |
| [features/avatar/api.ts](../apps/web/src/features/avatar/api.ts) | บันทึก avatar ผ่าน API และส่งสถานะ validation ให้ UI |
| [features/avatar/CharacterForm.tsx](../apps/web/src/features/avatar/CharacterForm.tsx) | สร้างหรือแก้ชื่อและ preset แล้วบันทึกผ่าน avatar API |
| [features/avatar/presets.ts](../apps/web/src/features/avatar/presets.ts) | รูปและชื่อ preset ที่อิง enum จาก OpenAPI |
| [features/avatar/preview-avatar.ts](../apps/web/src/features/avatar/preview-avatar.ts) | อ่านและบันทึก avatar จำลองโดยรองรับรูปแบบ storage ของต้นแบบ |
| [features/discover/api.ts](../apps/web/src/features/discover/api.ts) | ขอตั๋ว Join และบอกให้ Sign in, สร้างตัวละคร หรือลองใหม่ตามผล |
| [features/discover/Discover.tsx](../apps/web/src/features/discover/Discover.tsx) | แสดง Study Room ขอและส่งต่อตั๋วในหน่วยความจำเมื่อกด Walk in |
| [features/discover/AccountMenu.tsx](../apps/web/src/features/discover/AccountMenu.tsx) | เมนูบัญชีล่างซ้ายพร้อมแก้ตัวละคร เปลี่ยนธีม และ Sign out |
| [features/room/api.ts](../apps/web/src/features/room/api.ts) | ส่ง telemetry ของ Join และ Voice แบบ best effort |
| [features/room/StudyRoom.tsx](../apps/web/src/features/room/StudyRoom.tsx) | ตรวจบัญชีก่อนเปิด Library และแสดงสถานะ Game กับ Voice |
| [features/room/RoomHud.tsx](../apps/web/src/features/room/RoomHud.tsx) | แสดงชื่อห้อง ปุ่ม Leave และจำนวนผู้เล่นจาก Game หรือ mock |
| [features/room/PlayableRoom.tsx](../apps/web/src/features/room/PlayableRoom.tsx) | ประกอบฉากและผู้เล่น จัด input ตามมุมกล้อง ทำ prediction และ reconcile |
| [features/room/RoomCamera.tsx](../apps/web/src/features/room/RoomCamera.tsx) | หมุนและซูมกล้อง orthographic โดยยึดตัวละครของผู้เล่นไว้กลางจอขณะเดิน |
| [features/room/RoomCharacter.tsx](../apps/web/src/features/room/RoomCharacter.tsx) | เลือกหน้าตาจาก preset และอ่านตำแหน่งเพื่อแสดงตัวละคร |
| [features/room/character-rig.ts](../apps/web/src/features/room/character-rig.ts) | สร้างโมเดล chibi และแอนิเมชันจาก rig ของ Connecta หลัก |
| [features/room/skin-character.ts](../apps/web/src/features/room/skin-character.ts) | รวม geometry ของตัวละครเป็น skinned meshes |
| [features/room/BlobShadow.tsx](../apps/web/src/features/room/BlobShadow.tsx) | แสดงเงาใต้ตัวละครด้วย texture ร่วม |
| [features/room/Library.tsx](../apps/web/src/features/room/Library.tsx) | วาดฉาก Library และเฟอร์นิเจอร์เดิมใน R3F |
| [features/room/StaticBatch.tsx](../apps/web/src/features/room/StaticBatch.tsx) | รวม static meshes เพื่อลด draw calls |
| [features/room/dayCycle.ts](../apps/web/src/features/room/dayCycle.ts) | คำนวณแสงในฉาก Library |
| [features/room/attempt.ts](../apps/web/src/features/room/attempt.ts) | เปิดและปิด telemetry attempt โดยบันทึกเวลาจาก browser |
| [features/room/preview-room.ts](../apps/web/src/features/room/preview-room.ts) | ส่งต่อตั๋วแบบอ่านครั้งเดียวในหน่วยความจำ และเก็บสถานะเข้าห้องของแท็บ |
| [features/room/game-connection.ts](../apps/web/src/features/room/game-connection.ts) | เปิดและปิด Colyseus เผยแพร่ snapshot ส่ง movement และรับ Voice grant |
| [features/room/use-room-game.ts](../apps/web/src/features/room/use-room-game.ts) | จัดการตั๋วและสถานะ Game รวมถึง reload, retry และ Leave |
| [features/room/voice-connection.ts](../apps/web/src/features/room/voice-connection.ts) | ต่อ LiveKit ผูก audio tracks กับตำแหน่งและหยุดไมค์เมื่อออก |
| [features/room/use-room-voice.ts](../apps/web/src/features/room/use-room-voice.ts) | เริ่ม Voice เมื่อ Game พร้อม รายงานผลการเชื่อม LiveKit และจัดสถานะไมค์ |
| [features/preview/browser-storage.ts](../apps/web/src/features/preview/browser-storage.ts) | อ่านเขียน browser storage และแจ้งหน้าจอเมื่อค่าเปลี่ยน |
| [features/preview/PreviewTheme.tsx](../apps/web/src/features/preview/PreviewTheme.tsx) | จัดธีม light, dark และ system และจดค่าที่เลือก |
| [features/preview/PreviewControls.tsx](../apps/web/src/features/preview/PreviewControls.tsx) | แผงเลือกธีมและจำลองเหตุการณ์ของแต่ละหน้า |
| [features/preview/use-preview-action.ts](../apps/web/src/features/preview/use-preview-action.ts) | จัดสถานะรอและยกเลิก timer ของงานจำลอง |
| [features/preview/use-api-action.ts](../apps/web/src/features/preview/use-api-action.ts) | กันการส่ง API ซ้ำและยกเลิก request เมื่อออกจากหน้า |

## Workspace และ assets

| ไฟล์หรือโฟลเดอร์ | หน้าที่ |
| --- | --- |
| [package.json](../package.json) | กำหนด Node.js, pnpm และคำสั่งตรวจทั้ง workspace |
| [pnpm-workspace.yaml](../pnpm-workspace.yaml) | รวม package ใต้ `apps` และ `packages` |
| [pnpm-lock.yaml](../pnpm-lock.yaml) | ล็อกเวอร์ชัน dependencies |
| [.npmrc](../.npmrc) | ตั้ง pnpm แบบ hoisted สำหรับแชร์ dependency ใน workspace |
| [.gitignore](../.gitignore) | ระบุไฟล์ env และผล build ที่เป็นของเครื่องพัฒนา |
| [apps/web/package.json](../apps/web/package.json) | กำหนด dependencies ของเว็บ รวม Colyseus SDK, LiveKit client และ shared realtime schemas |
| [apps/web/next.config.ts](../apps/web/next.config.ts) | ตั้ง Next.js standalone output และตัวเลือก dev |
| [apps/web/tsconfig.json](../apps/web/tsconfig.json) | ตั้ง TypeScript เคร่งครัดและ alias `@/` |
| [apps/web/next-env.d.ts](../apps/web/next-env.d.ts) | ไฟล์ types ที่ Next.js สร้างให้ |
| [apps/web/public/assets](../apps/web/public/assets) | ฟอนต์ Nunito, ภาพปก Library, รูปสอง preset และภาพห้องสำหรับเดสก์ท็อปกับมือถือ |
| [apps/api/package.json](../apps/api/package.json) | กำหนด dependencies และ scripts ของ NestJS |
| [apps/api/openapi.snapshot.json](../apps/api/openapi.snapshot.json) | REST contract ของบัญชี, avatar, ตั๋ว Join และ telemetry |
| [apps/game/package.json](../apps/game/package.json) | กำหนด dependencies และ scripts ของ Colyseus |
| [packages/shared/package.json](../packages/shared/package.json) | Export realtime schema และกำหนด dependency Zod |
| [packages/shared/tsconfig.json](../packages/shared/tsconfig.json) | ตั้ง TypeScript สำหรับตรวจ shared package |
| [packages/shared/src/realtime.ts](../packages/shared/src/realtime.ts) | Zod schema และ types ของตั๋วเข้าห้อง, movement, player state, voice messages และ Join errors |
| [packages/db/package.json](../packages/db/package.json) | กำหนด Prisma dependencies และ scripts สำหรับ generate และ migrate |

## API NestJS

| ไฟล์ | หน้าที่ |
| --- | --- |
| [apps/api/src/app.ts](../apps/api/src/app.ts) | ประกอบ NestJS/Express, ติดตั้ง Better Auth และบันทึก HTTP metrics ของ Join ticket |
| [apps/api/src/main.ts](../apps/api/src/main.ts) | เปิด HTTP listener และปิด resources เมื่อ process หยุด |
| [apps/api/src/runtime.ts](../apps/api/src/runtime.ts) | ตรวจ config และสร้าง Prisma client กับ Better Auth |
| [apps/api/src/auth.ts](../apps/api/src/auth.ts) | ตั้ง Google OAuth, Guest session, rate limit และ Prisma adapter |
| [apps/api/src/account-guard.ts](../apps/api/src/account-guard.ts) | ตรวจ Origin และ session พร้อม rate limit ต่อ session |
| [apps/api/src/app.controller.ts](../apps/api/src/app.controller.ts) | ให้บริการบัญชี, avatar, join ticket, telemetry และ readiness |
| [apps/api/src/openapi.ts](../apps/api/src/openapi.ts) | ผูก contract กับ route decorators และสร้าง OpenAPI จาก NestJS |
| [apps/api/src/check-openapi.ts](../apps/api/src/check-openapi.ts) | เทียบ route และสถานะตอบกลับกับ snapshot และ export เอกสารได้ |
| [apps/api/src/metrics.ts](../apps/api/src/metrics.ts) | เก็บ HTTP metrics และนับ terminal event หนึ่งครั้งต่อ attempt |
| [apps/api/src/metrics.test.ts](../apps/api/src/metrics.test.ts) | ทดสอบ event ซ้ำ ลำดับสลับ และ missing result |
| [apps/api/scripts/local-sessions.ts](../apps/api/scripts/local-sessions.ts) | สร้างผู้ใช้และ session fixture ผ่าน Better Auth สำหรับ CLI ใน local เท่านั้น |
| [apps/api/tsconfig.json](../apps/api/tsconfig.json) | กำหนดโปรเจกต์ TypeScript ของ API และ local fixture |

## Game Colyseus

| ไฟล์ | หน้าที่ |
| --- | --- |
| [apps/game/src/main.ts](../apps/game/src/main.ts) | เปิด singleton Room และแยก internal listener จาก public WebSocket |
| [apps/game/src/config.ts](../apps/game/src/config.ts) | ตรวจ env สำหรับ Game และ LiveKit |
| [apps/game/src/study-room.ts](../apps/game/src/study-room.ts) | คุม seat, ticket, movement, reconnect และออก LiveKit grant |
| [apps/game/src/metrics.ts](../apps/game/src/metrics.ts) | เก็บจำนวนผู้เล่น ที่นั่ง tick เวลา reconnect และผล Voice grant |
| [apps/game/tsconfig.json](../apps/game/tsconfig.json) | กำหนดโปรเจกต์ TypeScript ของ Game |

## Database และ shared protocol

| ไฟล์ | หน้าที่ |
| --- | --- |
| [packages/db/prisma.config.ts](../packages/db/prisma.config.ts) | ตั้งค่า Prisma CLI และตำแหน่ง schema/migration |
| [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma) | นิยามตารางบัญชี session และ avatar |
| [packages/db/prisma/migrations/20261124000000_initial/migration.sql](../packages/db/prisma/migrations/20261124000000_initial/migration.sql) | สร้างตาราง และ constraints ของ avatar ครั้งแรก |
| [packages/db/prisma/migrations/migration_lock.toml](../packages/db/prisma/migrations/migration_lock.toml) | ระบุ PostgreSQL สำหรับ Prisma Migrate |
| [packages/db/src/client.ts](../packages/db/src/client.ts) | สร้าง Prisma client ด้วย adapter PostgreSQL |
| [packages/db/tsconfig.json](../packages/db/tsconfig.json) | กำหนดโปรเจกต์ TypeScript ของ DB |
| [packages/shared/src/layout.ts](../packages/shared/src/layout.ts) | พิกัดเฟอร์นิเจอร์ จุดเกิด และขอบเขตจาก Library เดิม |
| [packages/shared/src/navigation.ts](../packages/shared/src/navigation.ts) | ตรวจพื้นที่เดินได้และหาเส้นทางอ้อมเฟอร์นิเจอร์ |
| [packages/shared/src/movement.ts](../packages/shared/src/movement.ts) | ใช้กฎระยะเดิน การชน และการลดระดับเสียงตามระยะ |
| [packages/shared/src/ticket.ts](../packages/shared/src/ticket.ts) | ตรวจ avatar และเซ็นหรือยืนยันตั๋วเข้าห้อง |
| [packages/shared/src/server-config.ts](../packages/shared/src/server-config.ts) | ตรวจ config และเขียน structured log ของ backend |
| [packages/shared/src/ticket.test.ts](../packages/shared/src/ticket.test.ts) | ตรวจ signer, instance และอายุของตั๋ว |
| [packages/shared/src/movement.test.ts](../packages/shared/src/movement.test.ts) | ทดสอบ collision, pathfinding และระดับเสียงตามระยะ |

## Compose, monitoring และเครื่องมือทดสอบ

| ไฟล์ | หน้าที่ |
| --- | --- |
| [.env.example](../.env.example) | ค่าตัวอย่างสำหรับสแตก local |
| [.dockerignore](../.dockerignore) | กันไฟล์ local, secrets และ build outputs จาก build context |
| [Dockerfile](../Dockerfile) | สร้างสาม images และรวม Prisma CLI ไว้ใน API image สำหรับ migration |
| [compose.yaml](../compose.yaml) | เปิดสแตก local และรอ migration/health checks |
| [compose.vm.yaml](../compose.vm.yaml) | กำหนดพอร์ต HTTPS และ media สำหรับ VM |
| [compose.observability.yaml](../compose.observability.yaml) | เปิด monitoring profile และจำกัด UI ไปที่ loopback |
| [infra/Caddyfile](../infra/Caddyfile) | ส่ง traffic ไป Web, API, Game และ LiveKit และกัน routes ภายใน |
| [infra/observability/prometheus.yml](../infra/observability/prometheus.yml) | ตั้ง scrape targets และ Alertmanager |
| [infra/observability/alerts.yml](../infra/observability/alerts.yml) | ตั้งกฎ service, attempts และ disk |
| [infra/observability/alerts.test.yml](../infra/observability/alerts.test.yml) | ทดสอบ disk alert ด้วยชุดข้อมูลจำลอง |
| [infra/observability/alertmanager.yml](../infra/observability/alertmanager.yml) | จัดกลุ่ม alert ให้ดูใน Alertmanager local |
| [infra/observability/grafana/provisioning/datasources/local.yml](../infra/observability/grafana/provisioning/datasources/local.yml) | เตรียม Prometheus datasource และเอา Loki datasource เดิมออกเมื่อเปิด Grafana |
| [infra/observability/grafana/provisioning/dashboards/local.yml](../infra/observability/grafana/provisioning/dashboards/local.yml) | โหลด dashboard ใน Grafana |
| [infra/observability/grafana/dashboards/mini-connecta.json](../infra/observability/grafana/dashboards/mini-connecta.json) | Dashboard วินิจฉัย API, Game, Voice และทรัพยากร |
| [infra/observability/grafana/dashboards/mini-connecta-overview.json](../infra/observability/grafana/dashboards/mini-connecta-overview.json) | แสดง Join, Voice และ Reconnect ของ Study Room |
| [tsconfig.server.json](../tsconfig.server.json) | แชร์การตั้ง TypeScript ของ API, Game, DB และ shared |
| [eslint.config.mjs](../eslint.config.mjs) | กฎ lint ของ TypeScript และ scripts |
| [.prettierrc.json](../.prettierrc.json) | กำหนดรูปแบบโค้ด |
| [.prettierignore](../.prettierignore) | ข้าม generated files และ artifacts |
| [vitest.config.mts](../vitest.config.mts) | กำหนดชุด unit tests ของ workspace |
| [scripts/fixtures.mjs](../scripts/fixtures.mjs) | สร้าง fixture sessions ผ่าน Docker และเรียก REST ใน local |
| [scripts/mock-e2e.mjs](../scripts/mock-e2e.mjs) | ทดสอบ mock flow บนมือถือและเดสก์ท็อป |
| [scripts/real-e2e.mjs](../scripts/real-e2e.mjs) | ทดสอบสอง browser contexts กับระบบจริงผ่าน Caddy |
| [scripts/guest-e2e.mjs](../scripts/guest-e2e.mjs) | ทดสอบ Guest ตั้งแต่ Sign in ถึงเข้าห้องและ Sign out ผ่านเบราว์เซอร์ |
| [scripts/load-sessions.mjs](../scripts/load-sessions.mjs) | เตรียม session ของกลุ่มโหลด HTTP ในไฟล์ที่ ignore |
| [scripts/load-api.js](../scripts/load-api.js) | รันโหลดบัญชีและ Join ด้วย k6 หรือเลือกโหลดเฉพาะ `GET /api/me` |
| [scripts/load-game.mts](../scripts/load-game.mts) | รัน Colyseus bots และวัดเวลา join กับ movement ack |
| [scripts/load-voice.mjs](../scripts/load-voice.mjs) | รัน LiveKit CLI ด้วยค่าจาก .env local |
| [scripts/admission-check.mts](../scripts/admission-check.mts) | ทดสอบห้องเต็ม บัญชีซ้ำ ตั๋วหมดอายุ และ reconnect บนสแตกจริง |
| [scripts/combined-e2e.mjs](../scripts/combined-e2e.mjs) | เปิด browser contexts หลายคนและวัดการเดินกับเสียงในห้องเดียว |
| [scripts/ops-drill.mjs](../scripts/ops-drill.mjs) | ซ้อม Postgres/API หยุด ตรวจ readiness และ Alertmanager |
| [scripts/db-backup.mjs](../scripts/db-backup.mjs) | สำรองฐานข้อมูลและ restore ลง PostgreSQL แยก |

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

ตั๋ว Join, reconnection token และ Voice grant อยู่ในหน่วยความจำ พอ reload เว็บตรวจ session และ avatar แล้วขอตั๋วใหม่

**Cookie ของระบบจริง** Better Auth ใช้ `HttpOnly` และ `Secure` บน HTTPS ฝั่ง NestJS ตรวจ session ก่อนให้ใช้ API ที่ต้องล็อกอิน [แบบ API และ Auth](02-system-design/backend-api.md)
