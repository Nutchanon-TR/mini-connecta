# Mini Connecta · Runbook

## เปิดและหยุดในเครื่อง

จากราก Mini-Connecta คัดลอก `.env.example` เป็น `.env` ครั้งแรก ค่าตัวอย่างใช้เฉพาะ local ใส่ Google OAuth client ของงานเมื่อต้องการทดสอบ Google จริง และลงทะเบียน redirect URI เป็น `http://localhost:8080/api/auth/callback/google`

~~~sh
docker compose up -d --build
docker compose ps -a
docker compose logs --tail 50 migrate api game
~~~

เปิด `http://localhost:8080` ผ่าน Caddy ถ้าต้องการลอง UI ด้วยบัญชีจำลอง ใช้ `pnpm --filter @mini-connecta/web dev` จากรากโปรเจกต์ ฐานข้อมูลอยู่ใน volume และ job `migrate` ควรจบด้วย exit 0 ก่อน API healthy

~~~sh
docker compose exec -T api node -e 'fetch("http://127.0.0.1:2568/health/ready").then(async r=>{console.log(r.status,await r.text());process.exitCode=r.ok?0:1})'
docker compose exec -T game node -e 'fetch("http://127.0.0.1:2569/health/ready").then(r=>{console.log(r.status);process.exitCode=r.ok?0:1})'
curl http://localhost:8080/login
docker compose stop
~~~

หากใช้ monitoring ให้เพิ่ม `-f compose.yaml -f compose.observability.yaml --profile observability` หลัง `docker compose` ทั้งตอนเปิดและหยุด Grafana อยู่พอร์ต 3001, Prometheus 9090 และ Alertmanager 9093 บน loopback ดู log ของแต่ละบริการด้วย `docker compose logs --tail 100 api game`

## สำรองและทดลอง restore

~~~sh
node scripts/db-backup.mjs dump artifacts/before-release.dump
docker run -d --name mini-connecta-restore-drill -e POSTGRES_USER=mini -e POSTGRES_DB=mini -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
docker exec mini-connecta-restore-drill pg_isready -h 127.0.0.1 -U mini -d mini
node scripts/db-backup.mjs restore artifacts/before-release.dump mini-connecta-restore-drill
docker exec mini-connecta-restore-drill psql -U mini -d mini -c 'SELECT count(*) FROM avatars;'
docker stop mini-connecta-restore-drill
~~~

ตัวอย่าง restore ใช้ container แยกสำหรับทดสอบบนเครื่องเดียว พอร์ต DB อยู่ภายใน ทำซ้ำบนฐานใหม่ทุกครั้ง เก็บ checksum และสำเนานอก VM ตามพื้นที่ที่คณะอนุญาต

## Deploy และ rollback บน VM

1. ให้ owner ตั้ง `WEB_SITE`, `GAME_SITE`, `RTC_SITE`, `APP_ORIGIN`, `BETTER_AUTH_URL`, `GAME_WS_URL`, `LIVEKIT_PUBLIC_URL`, `LIVEKIT_NODE_IP` และ secrets ของ VM ตั้ง Google redirect URI ให้ตรงเว็บ HTTPS และยืนยัน firewall สำหรับ 443 TCP, 7881 TCP และ 7882 UDP ใช้ `ROOM_CAPACITY=15` สำหรับ playtest รอบแรกตามผล local
2. ตรวจ SHA-256 ของ image bundle แล้วใช้ `docker load -i RELEASE.tar` ตั้ง `RELEASE_TAG` เป็น tag ของ release ที่นำเข้า บันทึก tag ก่อนหน้าและดู schema compatibility ก่อนเปิดใช้
3. สำรอง DB ก่อน migration ถ้า migration ทำให้ release เก่าเขียนข้อมูลไม่เข้ากัน ให้หยุด traffic และงานเขียนทั้งหมดก่อนรัน migration
4. ใช้ `docker compose -f compose.yaml -f compose.vm.yaml up -d --no-build` Compose รอ migration job กับ readiness จากนั้น smoke test ผ่านเว็บจริงสองเครื่องตามแผนข้อ 7
5. ถ้า smoke ตกและ schema รองรับ release ก่อนหน้า ให้ตั้ง `RELEASE_TAG` กลับแล้วรันคำสั่งเดิมด้วย images ที่เก็บไว้ ตรวจ readiness และ avatar เดิมซ้ำ หาก schema ไม่เข้ากัน ให้ restore backup ไป DB แยก ตรวจข้อมูลและชี้ API กับ migration job ของ release เก่าไป DB ที่กู้แล้ว

เปิด monitoring ผ่านช่องทางผู้ดูแล เช่น SSH tunnel เปลี่ยนรหัส Grafana และกำหนดผู้รับ Alertmanager ก่อนรับ playtest local alertmanager แสดงสถานะผ่าน UI โดยใช้ receiver ภายใน

[แบบ Deployment](02-system-design/deployment.md) · [แบบ Observability](02-system-design/observability.md) · [แผน](plan.md)

## ตรวจชุดไฟล์ก่อนส่ง

- เปิดเทอร์มินัลจากราก Mini-Connecta และตรวจรายการไฟล์ของ checkout นี้ ทั้งไฟล์แก้และไฟล์ใหม่
- เลือก source, docs, migration และ Compose ที่เกี่ยวข้อง `.env.example` ใช้สำหรับค่าตัวอย่าง
- ตรวจให้ secrets, signed cookies, ไฟล์ avatar dump, logs ทดสอบ, `artifacts/`, Prisma client ที่ generate และผล build อยู่ในรายการ ignore
- หลัง owner อนุมัติจึงเริ่มขั้น 6.4
