import { createHash, X509Certificate } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import tls from 'node:tls';

const [site, caFile] = process.argv.slice(2);
if (!site || !caFile || !process.env.LOCALAPPDATA) {
  throw new Error('Usage on Windows: node scripts/open-vm-lab.mjs https://VM_IP CADDY_ROOT_CERT');
}

const origin = new URL(site);
if (origin.protocol !== 'https:' || origin.username || origin.password) {
  throw new Error('Use the HTTPS address of the lab VM.');
}

const edge = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]
  .filter(Boolean)
  .map((directory) => path.join(directory, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  .find(existsSync);
if (!edge) throw new Error('Microsoft Edge was not found.');

const ca = readFileSync(caFile);
const pin = await new Promise((resolve, reject) => {
  const host = origin.hostname.replace(/^\[|\]$/g, '');
  const socket = tls.connect(
    {
      host,
      port: Number(origin.port || 443),
      servername: isIP(host) ? undefined : host,
      ca,
      rejectUnauthorized: true,
    },
    () => {
      const leaf = new X509Certificate(socket.getPeerCertificate().raw);
      const key = leaf.publicKey.export({ type: 'spki', format: 'der' });
      socket.end();
      resolve(createHash('sha256').update(key).digest('base64'));
    },
  );
  socket.once('error', reject);
  socket.setTimeout(5_000, () => socket.destroy(new Error('Timed out connecting to the lab VM.')));
});

const profile = path.join(
  process.env.LOCALAPPDATA,
  'MiniConnectaLab',
  'Edge-' + createHash('sha256').update(origin.origin).digest('hex').slice(0, 12),
);
const browser = spawn(
  edge,
  [
    '--user-data-dir=' + profile,
    '--ignore-certificate-errors-spki-list=' + pin,
    '--no-first-run',
    new URL('/login', origin).href,
  ],
  { detached: true, stdio: 'ignore' },
);
browser.unref();
