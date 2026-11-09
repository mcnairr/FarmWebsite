#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_WORKER = 'mcnair-flight-feed';
const DEFAULT_OUTPUT = 'worker-logs';
const DEFAULT_LOOKBACK_DAYS = 3;
const OVERLAP_MS = 5 * 60 * 1000;
const WINDOW_MS = 6 * 60 * 60 * 1000;
const PAGE_SIZE = 2000;

function usage() {
  console.log(`Download retained Cloudflare Workers Observability logs as JSONL.

Usage: npm run logs:download -- [options]

Options:
  --worker NAME       Worker service name (default: ${DEFAULT_WORKER})
  --output DIR        Local output directory (default: ${DEFAULT_OUTPUT})
  --since-days N      First-run lookback (default: ${DEFAULT_LOOKBACK_DAYS})
  --account-id ID     Cloudflare account ID (otherwise uses CLOUDFLARE_ACCOUNT_ID
                      or discovers it with Wrangler)
  --help              Show this help

Authentication:
  Uses CLOUDFLARE_API_TOKEN when set; otherwise reuses your Wrangler OAuth login.
  An API token needs Workers Observability Write permission.
`);
}

export function parseArgs(argv) {
  const options = {
    worker: DEFAULT_WORKER,
    output: DEFAULT_OUTPUT,
    sinceDays: DEFAULT_LOOKBACK_DAYS,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--worker') options.worker = requiredValue(argv, ++i, arg);
    else if (arg === '--output') options.output = requiredValue(argv, ++i, arg);
    else if (arg === '--account-id') options.accountId = requiredValue(argv, ++i, arg);
    else if (arg === '--since-days') options.sinceDays = Number(requiredValue(argv, ++i, arg));
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isFinite(options.sinceDays) || options.sinceDays <= 0) {
    throw new Error('--since-days must be a positive number');
  }
  return options;
}

function requiredValue(argv, index, option) {
  if (!argv[index] || argv[index].startsWith('--')) throw new Error(`${option} requires a value`);
  return argv[index];
}

function wranglerWhoAmI() {
  const wranglerCli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  let output;
  try {
    output = execFileSync(process.execPath, [wranglerCli, 'whoami'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    throw new Error(`Could not discover the Cloudflare account with Wrangler.${detail ? `\n${detail}` : ''}`);
  }

  // `wrangler whoami` prints account IDs as 32 hexadecimal characters.
  const ids = [...output.matchAll(/\b[a-f0-9]{32}\b/gi)].map((match) => match[0]);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== 1) {
    throw new Error(
      uniqueIds.length === 0
        ? 'Wrangler did not report an account ID; set CLOUDFLARE_ACCOUNT_ID.'
        : 'Wrangler reported multiple accounts; set CLOUDFLARE_ACCOUNT_ID or use --account-id.',
    );
  }
  return { accountId: uniqueIds[0] };
}

async function readWranglerOAuthToken() {
  const configRoot = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'xdg.config')
      : path.join(os.homedir(), '.config'));
  const profile = process.env.CLOUDFLARE_PROFILE || 'default';
  const configFile = path.join(configRoot, '.wrangler', 'config', `${profile}.toml`);
  let contents;
  try { contents = await readFile(configFile, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('No Wrangler OAuth credential was found. Run `npx wrangler login` or set CLOUDFLARE_API_TOKEN.');
    }
    throw error;
  }
  const match = contents.match(/^oauth_token\s*=\s*("(?:[^"\\]|\\.)*")\s*$/m);
  if (!match) throw new Error(`Wrangler credential ${configFile} does not contain an OAuth token.`);
  return JSON.parse(match[1]);
}

async function cloudflareQuery({ accountId, token, worker, from, to, cursor }) {
  const body = {
    queryId: `download-${worker}`,
    timeframe: { from, to },
    view: 'events',
    limit: PAGE_SIZE,
    dry: true,
    parameters: {
      datasets: ['cloudflare-workers'],
      filterCombination: 'and',
      filters: [{
        key: '$metadata.service',
        operation: 'eq',
        type: 'string',
        value: worker,
      }],
    },
  };
  if (cursor) {
    body.offset = cursor;
    body.offsetDirection = 'next';
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const messages = [...(payload?.errors ?? []), ...(payload?.messages ?? [])]
      .map((item) => item.message).filter(Boolean).join('; ');
    const permissionHint = response.status === 403
      ? ' Set CLOUDFLARE_API_TOKEN to an API token with Workers Observability Write permission; the standard Wrangler OAuth token may not include it.'
      : '';
    throw new Error(`Cloudflare query failed (${response.status}): ${messages || response.statusText}.${permissionHint}`);
  }
  return payload?.result?.events?.events ?? [];
}

async function downloadWindow(options) {
  const events = [];
  let cursor;
  for (;;) {
    const page = await cloudflareQuery({ ...options, cursor });
    events.push(...page);
    if (page.length < PAGE_SIZE) break;
    const nextCursor = page.at(-1)?.$metadata?.id;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error('Cloudflare returned a full page without a usable pagination cursor.');
    }
    cursor = nextCursor;
  }
  return events;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

async function mergeEvents(outputDir, events) {
  const byDay = new Map();
  for (const event of events) {
    if (!event?.$metadata?.id || !Number.isFinite(event?.timestamp)) continue;
    const day = new Date(event.timestamp).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(event);
  }

  let added = 0;
  for (const [day, incoming] of byDay) {
    const destination = path.join(outputDir, `${day}.jsonl`);
    let existing = [];
    try {
      const text = await readFile(destination, 'utf8');
      existing = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const ids = new Set(existing.map((event) => event?.$metadata?.id).filter(Boolean));
    const fresh = incoming.filter((event) => !ids.has(event.$metadata.id));
    added += fresh.length;
    if (!fresh.length) continue;

    const merged = [...existing, ...fresh].sort((a, b) =>
      a.timestamp - b.timestamp || a.$metadata.id.localeCompare(b.$metadata.id));
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${merged.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
    await rename(temporary, destination);
  }
  return added;
}

async function acquireLock(file) {
  try {
    const handle = await open(file, 'wx');
    await handle.writeFile(`${process.pid}\n`);
    return handle;
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another download appears to be running (${file} exists).`);
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return usage();
  const outputDir = path.resolve(options.output);
  await mkdir(outputDir, { recursive: true });
  const lockFile = path.join(outputDir, '.download.lock');
  const lock = await acquireLock(lockFile);
  try {
    // `whoami` also refreshes an expired Wrangler OAuth token before we read it.
    const needsWranglerAuth = !process.env.CLOUDFLARE_API_TOKEN;
    const identity = (!options.accountId || needsWranglerAuth) ? wranglerWhoAmI() : {};
    const accountId = options.accountId || identity.accountId;
    const token = process.env.CLOUDFLARE_API_TOKEN || await readWranglerOAuthToken();
    const stateFile = path.join(outputDir, '.state.json');
    const state = await readJson(stateFile, {});
    if (state.worker && (state.worker !== options.worker || state.accountId !== accountId)) {
      throw new Error(`The output directory belongs to ${state.worker} in account ${state.accountId}; choose a different --output directory.`);
    }
    const now = Date.now();
    let from = state.lastSuccessfulTo
      ? Math.max(0, state.lastSuccessfulTo - OVERLAP_MS)
      : now - options.sinceDays * 24 * 60 * 60 * 1000;
    let downloaded = 0;
    let added = 0;

    while (from < now) {
      const to = Math.min(from + WINDOW_MS, now);
      process.stdout.write(`Querying ${new Date(from).toISOString()} to ${new Date(to).toISOString()}... `);
      const events = await downloadWindow({ accountId, token, worker: options.worker, from, to });
      downloaded += events.length;
      added += await mergeEvents(outputDir, events);
      await writeJsonAtomic(stateFile, {
        version: 1,
        worker: options.worker,
        accountId,
        lastSuccessfulTo: to,
        updatedAt: new Date().toISOString(),
      });
      console.log(`${events.length} event(s)`);
      from = to;
    }
    console.log(`Done: received ${downloaded} event(s), added ${added} new event(s) in ${outputDir}.`);
  } finally {
    await lock.close();
    await rm(lockFile, { force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
