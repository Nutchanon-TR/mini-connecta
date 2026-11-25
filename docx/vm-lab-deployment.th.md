# บันทึก Deploy Mini Connecta บน VM แล็บ

## ปัญหาที่เจอและวิธีแก้

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| `docker: command not found` | Ubuntu VM ยังไม่มี Docker ติดตั้ง `docker.io`, `docker-compose-v2` และ `docker-buildx` แล้วเปิด service Docker |
| `open /home/ned1/compose.yaml: no such file or directory` | รันจาก home ให้เข้า `~/mini-connecta` ก่อนใช้ Compose |
| `Set ROOM_JOIN_SECRET in .env` | เพิ่มค่าสุ่มใน `.env` ค่าเดียวกันถูกส่งให้ API และ Game เพื่อออกและตรวจตั๋วเข้าห้อง |
| Build ล้มด้วย `mini-connecta-api:local already exists` | `api` กับ `migrate` เคย build และเขียน tag เดียวพร้อมกัน ให้ `api` เป็นตัว build และ `migrate` ใช้ image เดียวกันจากเครื่อง |
| หน้า Login เคยเข้าไม่ได้หลัง Deploy | `WEB_SITE=:8080` ทำให้ Caddy ฟังคนละพอร์ตกับ VM overlay ที่เปิด 80 และ 443 ตั้ง site ให้ตรง VM |
| Guest ตอบ `403 INVALID_ORIGIN` | `APP_ORIGIN` และ `BETTER_AUTH_URL` ยังเป็น `localhost` ตั้งทั้งคู่ให้ตรงกับ URL ที่ผู้เล่นเปิด |
| Walk in ไม่ส่งคำขอตั๋ว | `crypto.randomUUID()` ต้องการ secure context เปลี่ยน URL ของ VM เป็น HTTPS |
| ได้ตั๋วแต่ปลายทางเกมเป็น `localhost` | เบราว์เซอร์ตีความ `localhost` เป็นเครื่องผู้เล่น ตั้ง `GAME_WS_URL` เป็น WSS ผ่าน `/game` บน Caddy |
| LiveKit ใช้ปลายทาง local | ใช้ WSS ผ่าน `/livekit` สำหรับ signaling และตั้ง `LIVEKIT_NODE_IP` เป็น IP ที่ผู้เล่นเข้าถึงได้ พอร์ต media ของ VM คือ TCP 7881 และ UDP 7882 |
| HTTPS redirect แล้ว TLS handshake ล้มเมื่อเปิดด้วย IP | เบราว์เซอร์อาจไม่ส่ง SNI สำหรับ IP ตั้ง `CADDY_DEFAULT_SNI` ให้เป็น IP ของใบรับรองที่ Caddy ต้องเลือก |
| ใบรับรองใหม่ขึ้น `certificate is not yet valid` ชั่วคราว | ตอนตรวจพบว่านาฬิกา VM เร็วกว่า Windows ราว 3 นาที เช็กเวลา UTC ของทั้งสองเครื่องเมื่อเจอซ้ำ เทสต์ผ่านเมื่อถึงเวลาเริ่มใช้ใบรับรอง |
| Google ตอบ `404 PROVIDER_NOT_FOUND` | ยังไม่มีโดเมน HTTPS และ OAuth Client ของงาน รอบแล็บใช้ Guest ตามที่ตกลงกัน |

## ตั้งค่า VM ภายใน

ใช้ค่าจริงใน `.env` ของ VM แทน `VM_IP` และเก็บ secrets ไว้ในไฟล์นี้

```dotenv
WEB_SITE=VM_IP
CADDY_DEFAULT_SNI=VM_IP
APP_ORIGIN=https://VM_IP
BETTER_AUTH_URL=https://VM_IP
GAME_WS_URL=wss://VM_IP/game
LIVEKIT_PUBLIC_URL=wss://VM_IP/livekit
LIVEKIT_NODE_IP=VM_IP
```

Caddy รับเว็บ, API, matchmaking, WebSocket ของ Game และ LiveKit signaling ผ่าน HTTPS พอร์ต 443. `/game` ตัด prefix ก่อนส่ง upstream และบล็อก metrics กับเส้นทางภายใน. `/livekit` ส่งเฉพาะ `/rtc` และเส้นทางย่อย. Prometheus, Grafana และ Alertmanager ใช้ loopback ของ VM.

รันจาก `~/mini-connecta` บน VM ถ้ามี release image ของแอปแล้ว ให้ข้ามคำสั่ง `build` และใช้ `RELEASE_TAG` ของ image นั้น

```bash
labcompose() {
  sudo docker compose -f compose.yaml -f compose.vm.yaml \
    -f compose.observability.yaml --profile observability "$@"
}
labcompose config --quiet
labcompose build api game web
labcompose up -d --no-build
labcompose ps -a
```

`migrate` ควรเป็น `Exited (0)` แล้วบริการหลักขึ้น `Up` และมี health check ผ่าน เว็บ HTTP ควร redirect ไป HTTPS

## เปิดเล่นในโปรไฟล์ Edge แยก

VM ใช้ CA ภายในจาก Caddy ดึงเฉพาะใบรับรองสาธารณะจาก SSH ที่ยืนยันแล้ว

```bash
sudo docker compose -f compose.yaml -f compose.vm.yaml exec -T caddy \
  cat /data/caddy/pki/authorities/local/root.crt
```

เก็บบล็อก `BEGIN CERTIFICATE` ถึง `END CERTIFICATE` เป็น `caddy-root.crt` ใน `%LOCALAPPDATA%\MiniConnectaLab` บน Windows จากนั้นรันจากโฟลเดอร์โปรเจกต์

```powershell
node .\scripts\open-vm-lab.mjs https://VM_IP "$env:LOCALAPPDATA\MiniConnectaLab\caddy-root.crt"
```

สคริปต์ตรวจ chain, ชื่อปลายทาง และอายุใบรับรองกับ CA ที่ให้มา จากนั้นตั้งค่า Edge โปรไฟล์แล็บให้ยอมรับเฉพาะ public key ของใบรับรองปลายทางที่ตรวจแล้ว. ถ้า Caddy เปลี่ยน key แล้ว Edge ยังเปิดอยู่ ให้ปิดหน้าต่างแล็บทั้งหมดแล้วรันสคริปต์ใหม่. เลือก **Continue as guest** แล้วสร้างตัวละครและกด **Walk in**.

## ผลที่ตรวจบน VM

- Compose config บน local และ VM ผ่าน และ Caddy validate ผ่าน
- Build บน VM ได้ image `api`, `game`, `web` ครบ โดยพบ API tag เดียว `migrate` จบด้วย `Exited (0)`
- ทดสอบจาก Windows ว่า HTTP redirect ด้วย `308` และหน้า HTTPS Login ตอบ `200` หลังตรวจใบรับรองกับ CA ของ VM
- ใช้ Edge สอง browser contexts สร้างบัญชี Guest และตัวละคร เข้าห้อง 3D และเห็นอีกฝ่าย ปลายทาง matchmaking ตอบ `200`
- ใช้ไมค์จำลองในเบราว์เซอร์เพื่อทดสอบ LiveKit ส่ง audio track ให้ผู้เล่นอีกคน เดินออกและกลับเข้าระยะแล้วระดับเสียงเปลี่ยนตามระยะ ปิดไมค์แล้ว track หาย
- จำลองเน็ตหลุดและกลับมาเฉพาะ browser context ของผู้เล่นหนึ่งคน ระบบ reconnect อัตโนมัติได้ จากนั้นรีโหลดเพื่อเข้าห้องใหม่ ออกห้องและ Sign out ทั้งสองบัญชีได้
- เส้นทาง metrics, health และ internal ที่ทดสอบผ่าน Caddy ตอบ `404` ส่วน Prometheus เก็บข้อมูลจาก `api`, `game`, `livekit`, `node` ผ่านเครือข่ายภายใน
- `pnpm test` บน local ผ่าน 6 เทสต์

เทสต์เสียงนี้ใช้ไมค์จำลองและสอง browser contexts บน Windows เครื่องเดียว รอบสองเครื่องจริงตรวจให้ครบตามขั้น 7.4 ของ [แผน Deploy](plan.md) โดยเฉพาะเส้นทาง VPN หรือเครือข่ายอื่น.

[Runbook หลัก](runbook.th.md) · [Deployment design](02-system-design/deployment.md) · [Caddy HTTPS](https://caddyserver.com/docs/automatic-https) · [LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/)
