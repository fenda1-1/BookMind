import fs from 'node:fs';

const url = process.env.BOOKMIND_MONITOR_URL || 'http://127.0.0.1:1420/';
const logPath = process.env.BOOKMIND_MONITOR_LOG || 'browser-proxy-monitor.log';
const intervalMs = Number(process.env.BOOKMIND_MONITOR_INTERVAL_MS || 5000);

async function tick() {
  const ts = new Date().toLocaleString('sv-SE', { hour12: false });
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    fs.appendFileSync(logPath, `${ts} browser_proxy_status=${response.status} url=${url}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/\r|\n/g, ' ') : String(error);
    fs.appendFileSync(logPath, `${ts} browser_proxy_error=${message} url=${url}\n`);
  }
}

await tick();
setInterval(tick, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5000);
