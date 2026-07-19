import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const artifactsDir = resolve(rootDir, 'acceptance-artifacts/ai-research-desk');
const chromePath = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const vitePort = Number(process.env.BOOKMIND_ACCEPTANCE_VITE_PORT ?? 1437);
const debugPort = Number(process.env.BOOKMIND_ACCEPTANCE_DEBUG_PORT ?? 9337);
const cloudPort = Number(process.env.BOOKMIND_ACCEPTANCE_CLOUD_PORT ?? 17831);
const appUrl = `http://127.0.0.1:${vitePort}/`;
const cloudBaseUrl = `http://127.0.0.1:${cloudPort}/v1`;

mkdirSync(artifactsDir, { recursive: true });
const logPath = join(artifactsDir, 'acceptance.log');
writeFileSync(logPath, '');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  appendFileSync(logPath, `${line}\n`);
}

const sampleBook = {
  id: 'acceptance-book',
  title: 'BookMind AI 研究台示例',
  displayTitle: 'BookMind AI 研究台示例',
  author: 'BookMind',
  format: 'TXT',
  status: '已索引',
  progress: 0,
  fileName: 'BookMind AI 研究台示例.txt',
  filePath: 'acceptance://BookMind AI 研究台示例.txt',
  coverLabel: 'AI',
  coverTone: 'indigo',
  deleted: false,
  deletedAt: '',
  contentHash: 'acceptance-sample',
  importedAt: '2026-06-07T00:00:00.000Z',
  content: '第一章 雨夜病院\n林七夜在雨夜抵达病院，墙上的钟声忽然停止。医生记录他的异常反应，并提醒他不要相信走廊尽头的影子。\n\n第二章 证据纸条\n主角开始把每次钟声、影子和医生的措辞记录成证据纸条。',
  chunks: [
    {
      id: 'chunk-acceptance-1',
      bookId: 'acceptance-book',
      bookTitle: 'BookMind AI 研究台示例',
      chapter: '第一章 雨夜病院',
      ordinal: 0,
      text: '林七夜在雨夜抵达病院，墙上的钟声忽然停止。医生记录他的异常反应。',
    },
  ],
};

let settings = {
  schemaVersion: 1,
  trashRetentionDays: 3,
  aiApiKey: '',
  aiApiBaseUrl: cloudBaseUrl,
  aiEndpointMode: 'responses',
};
let books = [];
let cloudRequestCount = 0;
let indexDiagnostics = {
  queuedCount: 0,
  parsingCount: 0,
  indexedChunkCount: 0,
  indexedBookCount: 0,
  ftsAvailable: false,
  ftsDatabasePath: '',
  recentError: '',
};

const cloudServer = createServer((request, response) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }
  if (request.method !== 'POST' || !request.url?.endsWith('/responses')) {
    response.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'not found' } }));
    return;
  }
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    cloudRequestCount += 1;
    const parsed = JSON.parse(body || '{}');
    const prompt = String(parsed.input ?? '');
    if (parsed.stream !== true) {
      response.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ model: 'acceptance-mock', output_text: 'pong' }));
      return;
    }
    response.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    if (/pong/i.test(prompt) || /请只回复 pong/.test(prompt)) {
      response.end('data: {"type":"response.output_text.delta","delta":"pong"}\n\ndata: [DONE]\n\n');
      return;
    }
    const answer = '云端回答：已按阅读研究台指令总结当前章节，并保留隐私确认。';
    response.end(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: answer })}\n\ndata: [DONE]\n\n`);
  });
});

function invokeMock(cmd, args) {
  if (cmd === 'get_library_books') return Promise.resolve(books);
  if (cmd === 'get_reader_document') return Promise.resolve(sampleBook);
  if (cmd === 'import_dev_sample_book_and_index') {
    books = [sampleBook];
    indexDiagnostics = {
      queuedCount: 0,
      parsingCount: 0,
      indexedChunkCount: sampleBook.chunks.length,
      indexedBookCount: 1,
      ftsAvailable: true,
      ftsDatabasePath: 'acceptance://fts.sqlite',
      recentError: '',
    };
    return Promise.resolve(sampleBook);
  }
  if (cmd === 'run_parse_and_index_tasks') {
    indexDiagnostics.indexedChunkCount = sampleBook.chunks.length;
    indexDiagnostics.indexedBookCount = 1;
    indexDiagnostics.ftsAvailable = true;
    return Promise.resolve([{ id: 'task-acceptance', bookId: sampleBook.id, title: sampleBook.displayTitle, status: 'done', progress: 100, message: 'indexed' }]);
  }
  if (cmd === 'get_index_diagnostics') return Promise.resolve(indexDiagnostics);
  if (cmd === 'get_task_statuses') return Promise.resolve([]);
  if (cmd === 'get_app_settings') return Promise.resolve(settings);
  if (cmd === 'update_app_settings') {
    settings = { ...settings, ...(args?.settings ?? {}) };
    return Promise.resolve(settings);
  }
  if (cmd === 'answer_from_local_index') {
    const request = args?.request ?? {};
    if (request.userText?.includes('force_local_no_result') || request.retrievalQuery === 'force_local_no_result') {
      return Promise.resolve({
        answer: '本地索引诊断：未找到与当前检索 query 匹配的片段，但不会回退到完整 instruction 检索。',
        citations: [],
        diagnostics: { scope: request.scope, queryUsed: 'force_local_no_result', chunkCount: 1, ftsAvailable: true, resultCount: 0, fallbackUsed: false, errorKind: 'no-result', recommendations: ['改用当前章全文总结', '改用云端模式'] },
      });
    }
    return Promise.resolve({
      answer: `严格本地模式 · 已使用结构化 retrieval query 检索本地索引。\n检索 query：${request.retrievalQuery ?? '总结'}\n任务：${request.instruction ?? '总结本章'}\n补充：${request.userText ?? '请用三点总结'}\n\n证据摘要：\n[1] 林七夜在雨夜抵达病院，墙上的钟声忽然停止。`,
      citations: [{ id: 1, label: 'BookMind AI 研究台示例 · 第一章 雨夜病院', text: sampleBook.chunks[0].text, targetId: 'chunk-acceptance-1' }],
      diagnostics: { scope: request.scope, queryUsed: request.retrievalQuery, chunkCount: 1, ftsAvailable: true, resultCount: 1, fallbackUsed: false, recommendations: [] },
    });
  }
  if (cmd === 'save_reader_record' || cmd === 'get_reader_record') return Promise.resolve(null);
  if (cmd === 'save_ai_note' || cmd === 'save_highlight') return Promise.resolve({});
  if (cmd === 'cancel_local_ai_answer') return Promise.resolve();
  if (cmd === 'get_notes' || cmd === 'get_highlights' || cmd === 'get_flashcards') return Promise.resolve([]);
  return Promise.resolve([]);
}

function tauriPrelude() {
  window.__BOOKMIND_ACCEPTANCE_PENDING__ = window.__BOOKMIND_ACCEPTANCE_PENDING__ || new Map();
  window.__BOOKMIND_ACCEPTANCE_RESOLVE__ = (id, value) => {
    const pending = window.__BOOKMIND_ACCEPTANCE_PENDING__.get(id);
    if (pending) {
      pending.resolve(value);
      window.__BOOKMIND_ACCEPTANCE_PENDING__.delete(id);
    }
  };
  window.__BOOKMIND_ACCEPTANCE_REJECT__ = (id, error) => {
    const pending = window.__BOOKMIND_ACCEPTANCE_PENDING__.get(id);
    if (pending) {
      pending.reject(new Error(error));
      window.__BOOKMIND_ACCEPTANCE_PENDING__.delete(id);
    }
  };
  window.__BOOKMIND_ACCEPTANCE_INVOKE__ = (cmd, args) => {
    const id = Math.floor(Math.random() * 1_000_000_000);
    return new Promise((resolve, reject) => {
      window.__BOOKMIND_ACCEPTANCE_PENDING__.set(id, { resolve, reject });
      window.__BOOKMIND_ACCEPTANCE_BINDING__(JSON.stringify([id, cmd, args]));
    });
  };
  window.__TAURI_INTERNALS__ = {
    callbacks: {},
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    transformCallback(callback) {
      const id = Math.floor(Math.random() * 1_000_000);
      this.callbacks[id] = callback;
      return id;
    },
    unregisterCallback(id) {
      delete this.callbacks[id];
    },
    invoke: (cmd, args) => window.__BOOKMIND_ACCEPTANCE_INVOKE__(cmd, args),
    convertFileSrc: (filePath) => filePath,
  };
}

async function main() {
  log(`Acceptance ports vite=${vitePort} debug=${debugPort} cloud=${cloudPort}`);
  log('Starting mock cloud endpoint');
  await listen(cloudServer, cloudPort);
  log('Starting Vite dev server');
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  pipeProcessLog('vite', vite);
  const chromeUserData = resolve(artifactsDir, 'chrome-profile');
  log('Starting headless Chrome');
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeUserData}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  pipeProcessLog('chrome', chrome);

  try {
    log('Waiting for Vite');
    await waitForHttp(appUrl, 30_000);
    log('Opening Chrome page');
    const page = await openChromePage();
    await page.send('Runtime.addBinding', { name: '__BOOKMIND_ACCEPTANCE_BINDING__' });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `${tauriPrelude.toString()}; tauriPrelude();` });
    await page.send('Runtime.evaluate', { expression: `${tauriPrelude.toString()}; tauriPrelude();` });
    page.onBinding('__BOOKMIND_ACCEPTANCE_BINDING__', async ({ args }) => {
      const [id, cmd, invokeArgs] = JSON.parse(args);
      try {
        const result = await invokeMock(cmd, invokeArgs);
        await page.resolveBinding(id, result);
      } catch (error) {
        await page.rejectBinding(id, String(error?.message ?? error));
      }
    });
    log('Navigating app');
    await page.send('Page.navigate', { url: appUrl });
    await page.waitForLoad();
    try {
      await page.waitForText('数据总览', 60_000);
    } catch (error) {
      await page.writeDebugSnapshot('debug-initial-page');
      throw error;
    }

    log('Importing indexed sample');
    await page.clickText('任务中心');
    await page.waitForText('后台任务');
    await page.clickText('导入示例书籍并索引');
    assert.ok(indexDiagnostics.indexedChunkCount > 0, 'index diagnostics must show chunks > 0');
    try {
      await page.waitForText('BookMind AI 研究台示例', 20_000);
    } catch (error) {
      await page.writeDebugSnapshot('debug-task-import');
      throw error;
    }

    log('Opening AI panel');
    await page.clickText('阅读现场');
    await page.waitForText('BookMind AI 研究台示例');
    await page.ensureAiPanelOpen();
    await page.screenshot(join(artifactsDir, 'ai-panel.png'));

    log('Testing slash command menu and local answer');
    await page.typeSelector('textarea', '/总结');
    try {
      await page.waitForText('/总结本章');
    } catch (error) {
      await page.writeDebugSnapshot('debug-slash-command');
      throw error;
    }
    await page.screenshot(join(artifactsDir, 'slash-command-menu.png'));
    await page.clickText('/总结本章');
    await page.typeSelector('textarea', '请用三点总结');
    await page.clickText('提问');
    await page.waitForText('严格本地模式');
    const localAnswer = await page.textContent('.ai-response-card');
    assert.doesNotMatch(localAnswer, /未找到与完整 instruction 相关片段/);
    await page.screenshot(join(artifactsDir, 'local-success-response.png'));

    log('Testing cloud settings and pong connection');
    await page.clickText('设置');
    await page.waitForText('AI API 设置');
    await page.fillByLabel('API Key', 'sk-acceptance');
    await page.fillByLabel('API 请求地址', cloudBaseUrl);
    await page.clickText('测试连接');
    try {
      await page.waitForText('pong');
    } catch (error) {
      await page.writeDebugSnapshot('debug-cloud-settings');
      throw error;
    }
    await page.screenshot(join(artifactsDir, 'settings-ai-api.png'));

    log('Testing cloud answer privacy confirmation');
    await page.clickText('阅读现场');
    await page.ensureAiPanelOpen();
    await page.clickText('云端');
    await page.clickText('本次允许发送当前范围');
    await page.typeSelector('textarea', '云端模式请继续按三点总结');
    await page.clickText('提问');
    await page.waitForText('云端回答');
    await page.screenshot(join(artifactsDir, 'cloud-success-response.png'));

    await page.clickText('本地');
    await page.fillSelector('textarea', 'force_local_no_result');
    await page.clickText('提问');
    try {
      await page.waitForText('本地索引诊断');
    } catch (error) {
      await page.writeDebugSnapshot('debug-error-diagnostics');
      throw error;
    }
    await page.screenshot(join(artifactsDir, 'error-diagnostics.png'));

    log('Writing acceptance summary');
    const summary = {
      appUrl,
      cloudBaseUrl,
      indexedChunkCount: indexDiagnostics.indexedChunkCount,
      cloudRequestCount,
      screenshots: [
        'ai-panel.png',
        'slash-command-menu.png',
        'local-success-response.png',
        'settings-ai-api.png',
        'cloud-success-response.png',
        'error-diagnostics.png',
      ],
    };
    writeFileSync(join(artifactsDir, 'acceptance-summary.json'), JSON.stringify(summary, null, 2));
    log(`AI research desk acceptance artifacts written to ${artifactsDir}`);
  } finally {
    vite.kill();
    chrome.kill();
    cloudServer.close();
  }
}

function pipeProcessLog(name, child) {
  child.stdout?.on('data', (chunk) => appendFileSync(logPath, `[${name}:stdout] ${chunk}`));
  child.stderr?.on('data', (chunk) => appendFileSync(logPath, `[${name}:stderr] ${chunk}`));
  child.on('exit', (code, signal) => log(`${name} exited code=${code ?? ''} signal=${signal ?? ''}`));
  child.on('error', (error) => log(`${name} failed: ${error.message}`));
}

function listen(server, port) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', resolveListen);
  });
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function openChromePage() {
  const version = await retryJson(`http://127.0.0.1:${debugPort}/json/version`, 30_000);
  assert.ok(version.webSocketDebuggerUrl, 'Chrome debugger endpoint must expose a browser websocket');
  const target = await fetch(`http://127.0.0.1:${debugPort}/json/new?about%3Ablank`, { method: 'PUT' }).then((response) => response.json());
  return new CdpPage(target.webSocketDebuggerUrl);
}

async function retryJson(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // retry
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.bindings = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.wsUrl);
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolveMessage, rejectMessage } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) rejectMessage(new Error(message.error.message));
        else resolveMessage(message.result);
        return;
      }
      if (message.method === 'Runtime.bindingCalled') {
        const handler = this.bindings.get(message.params.name);
        if (handler) void handler({ seq: message.params.executionContextId, args: message.params.payload });
      }
      if (message.method === 'Runtime.consoleAPICalled') {
        const text = message.params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ');
        log(`browser console ${message.params.type}: ${text}`);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        log(`browser exception: ${message.params.exceptionDetails?.text ?? 'unknown'}`);
      }
    });
    await new Promise((resolveOpen) => this.socket.addEventListener('open', resolveOpen, { once: true }));
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
  }

  send(method, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return this.connect().then(() => this.send(method, params));
    }
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolveMessage, rejectMessage });
    });
  }

  onBinding(name, handler) {
    this.bindings.set(name, handler);
  }

  async resolveBinding(seq, result) {
    await this.evaluate(`window.__BOOKMIND_ACCEPTANCE_RESOLVE__?.(${seq}, ${JSON.stringify(result)})`);
  }

  async rejectBinding(seq, error) {
    await this.evaluate(`window.__BOOKMIND_ACCEPTANCE_REJECT__?.(${seq}, ${JSON.stringify(error)})`);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }

  async waitForLoad() {
    await this.waitForExpression('document.readyState === "complete"', 60_000);
    await this.evaluate(`${tauriPrelude.toString()}; tauriPrelude();`);
    await this.waitForExpression('document.querySelector("#root")?.children.length > 0', 20_000);
  }

  waitForExpression(expression, timeoutMs = 10_000) {
    return waitUntil(async () => Boolean(await this.evaluate(expression)), timeoutMs, expression);
  }

  waitForText(text, timeoutMs = 10_000) {
    return this.waitForExpression(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, timeoutMs);
  }

  async clickText(text) {
    const ok = await this.evaluate(`
      (() => {
        const needle = ${JSON.stringify(text)};
        const elements = [...document.querySelectorAll('button, [role="button"], input, textarea, a, label')];
        const target = elements.find((element) => [
          element.innerText,
          element.value,
          element.getAttribute('aria-label'),
          element.getAttribute('data-label'),
          element.getAttribute('title'),
        ].filter(Boolean).some((value) => String(value).includes(needle)));
        if (!target) return false;
        target.click();
        return true;
      })()
    `);
    assert.equal(ok, true, `expected clickable text: ${text}`);
  }

  async clickSelector(selector) {
    const ok = await this.evaluate(`
      (() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        if (!target) return false;
        target.click();
        return true;
      })()
    `);
    assert.equal(ok, true, `expected selector: ${selector}`);
  }

  async ensureAiPanelOpen() {
    const alreadyOpen = await this.evaluate('document.body?.innerText.includes("阅读研究台")');
    if (!alreadyOpen) await this.clickSelector('.reader-ai-icon-btn');
    await this.waitForText('阅读研究台');
  }

  async typeSelector(selector, text) {
    const ok = await this.evaluate(`
      (() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        if (!target) return false;
        target.focus();
        const nextValue = (target.value || '') + ${JSON.stringify(text)};
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
        setter?.call(target, nextValue);
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(text)} }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
    assert.equal(ok, true, `expected input selector: ${selector}`);
  }

  async fillByLabel(label, value) {
    const ok = await this.evaluate(`
      (() => {
        const needle = ${JSON.stringify(label)};
        const inputs = [...document.querySelectorAll('input, textarea')];
        const target = inputs.find((input) => (input.getAttribute('aria-label') || input.closest('label')?.innerText || '').includes(needle));
        if (!target) return false;
        target.focus();
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
        setter?.call(target, ${JSON.stringify(value)});
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
    assert.equal(ok, true, `expected labeled input: ${label}`);
  }

  async fillSelector(selector, value) {
    const ok = await this.evaluate(`
      (() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        if (!target) return false;
        target.focus();
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
        setter?.call(target, ${JSON.stringify(value)});
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: ${JSON.stringify(value)} }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
    assert.equal(ok, true, `expected input selector: ${selector}`);
  }

  async textContent(selector) {
    return await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
  }

  async screenshot(path) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(path, Buffer.from(result.data, 'base64'));
  }

  async writeDebugSnapshot(name) {
    const snapshot = await this.evaluate(`(() => ({
      url: location.href,
      readyState: document.readyState,
      title: document.title,
      bodyText: document.body?.innerText ?? '',
      html: document.documentElement?.outerHTML?.slice(0, 12000) ?? '',
      hasTauriInternals: Boolean(window.__TAURI_INTERNALS__),
      hasAcceptanceInvoke: Boolean(window.__BOOKMIND_ACCEPTANCE_INVOKE__),
    }))()`);
    writeFileSync(join(artifactsDir, `${name}.json`), JSON.stringify(snapshot, null, 2));
    await this.screenshot(join(artifactsDir, `${name}.png`));
  }
}

async function waitUntil(check, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
