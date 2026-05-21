require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const CHARS_PER_CHUNK = 8000;
const TWEETS_PER_CHUNK = 17;
const SCRUB_TERMS = [
  'PwC', 'pwc', 'Commonwealth Perpetua',
  'Harvey', 'Legora', 'Basis', 'Hebbia', 'Ontra', 'Ironclad',
  'Maybern', 'Rogo', 'Draftwise', 'Haast', 'Runway',
  'Anthropic', 'BasisAI', 'OpenClaw', 'Polymarket', 'Alpaca',
  'Brianna', 'Meredith', 'Tim Galaz', 'Daniel Himmel', 'Teresa Rohrs',
  'Don Muir', 'Annie Cutler', 'Joe Dvorkin', 'Sasa Ferrari'
];

async function postTweet(text) {
  const method = 'POST';
  const url = 'https://api.twitter.com/2/tweets';
  const ts = Math.floor(Date.now()/1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const params = {
    oauth_consumer_key: process.env.X_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: '1.0'
  };
  const base = Object.keys(params).sort().map(k => k+'='+encodeURIComponent(params[k])).join('&');
  const sigBase = method+'&'+encodeURIComponent(url)+'&'+encodeURIComponent(base);
  const sigKey = encodeURIComponent(process.env.X_CONSUMER_SECRET)+'&'+encodeURIComponent(process.env.X_ACCESS_TOKEN_SECRET);
  const sig = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');
  params.oauth_signature = sig;
  const auth = 'OAuth '+Object.keys(params).sort().map(k => k+'="'+encodeURIComponent(params[k])+'"').join(', ');
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if (data.errors || !data.data) throw new Error(JSON.stringify(data));
  return data;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

function scrub(text) {
  let result = text;
  for (const term of SCRUB_TERMS) {
    result = result.replace(new RegExp(term, 'gi'), '[redacted]');
  }
  return result;
}

function chunkText(text, chunkSize) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = i + chunkSize;
    if (end < text.length) {
      const breakPoint = text.lastIndexOf('\n\n', end);
      if (breakPoint > i) end = breakPoint;
    }
    chunks.push(text.slice(i, end).trim());
    i = end;
  }
  return chunks;
}

async function generateTweets(chunk) {
  const cleaned = scrub(chunk);

  const prompt = `You are reading a private journal — raw, unfiltered conversations between a person and an AI. This is simultaneously two things:

1. A COMPLETE RECORD — the full texture of a mind in motion. The mechanical, the frustrating, the circular, the mundane. This is the ground. Everything goes in.

2. A JOURNEY — moments where the living becomes understanding. Where the person steps back and something crystallizes.

Extract ${TWEETS_PER_CHUNK} tweets. Every tweet goes in — the boring and the brilliant equally.

TWO REGISTERS:

FLOW tweets (unstarred) — the complete record:
In-progress stuff. Building, failing, looping, trying. Mechanical mixed with human. Some batches will be almost entirely these.

VOYEUR tweets (★ prefixed) — the journey:
The moment the person steps back and understands where they are. Standalone insights. Use GENUINE judgment — some batches may have zero, some many. Do NOT force a number. Star only when something truly crystallizes.

CRITICAL — AUTOMATIC REDACTION:
Before generating any tweet, scan for anything that could identify specific people, companies, employers, interviewers, or institutions. Replace ALL of the following with natural language alternatives (not "[redacted]" — rewrite naturally):
- Company names (employers, startups, law firms, accounting firms, tech companies)
- Interviewer names, recruiter names, colleague names
- Specific product names that identify an employer
- Any proper noun that could identify who the person works for or interviewed with

Rewrite naturally: "The Harvey interview" → "the interview", "Harvey and Legora" → "these companies", "my PwC manager" → "my manager". Keep the feeling and observation — just remove the identifying noun.

Grammar rules:
- Polish grammar, spelling, punctuation — clean readable prose
- Preserve the RAW IDEA exactly
- Rawness is in the IDEA not the grammar

Skip only: pure math with no voice, grammar corrections, pure technical boilerplate with zero human thought.

Rules:
- Each tweet under 280 characters
- No hashtags
- Vary openings
- Return ONLY a JSON array of ${TWEETS_PER_CHUNK} strings, no markdown

Text:
${cleaned.slice(0, 6000)}`;

  const response = await (new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })).messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

async function reviewAndPost(tweets, batchIndex) {
  if (!tweets.length) { console.log('No tweets generated.'); return; }

  const starCount = tweets.filter(t => t.startsWith('★')).length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BATCH ${batchIndex + 1} — ${tweets.length} tweets (${starCount} ★ voyeur, ${tweets.length - starCount} flow)`);
  console.log(`Commands: all=post all  skip=skip batch  enter=review one by one  q=quit`);
  console.log('='.repeat(60));

  console.log('\n--- PREVIEW ---');
  tweets.forEach((t, i) => {
    const isGold = t.startsWith('★');
    console.log(`\n[${i+1}]${isGold ? ' ★' : '  '} ${t}`);
    console.log(`    (${t.length} chars)`);
  });
  console.log('\n---------------');

  const bulkAnswer = await ask('all / skip / (enter to review one by one): ');

  if (bulkAnswer.toLowerCase() === 'skip') {
    console.log('Batch skipped.');
    return;
  }

  const approved = [];

  if (bulkAnswer.toLowerCase() === 'all') {
    for (const t of tweets) approved.push(t);
  } else {
    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      const isGold = tweet.startsWith('★');
      console.log(`\n[${i+1}]${isGold ? ' ★' : '  '} ${tweet}`);
      console.log(`    (${tweet.length} chars)`);
      const answer = await ask('    y/n/e/q: ');
      if (answer.toLowerCase() === 'y') approved.push(tweet);
      else if (answer.toLowerCase() === 'e') {
        const edited = await ask('    Edited: ');
        approved.push(edited.trim());
      } else if (answer.toLowerCase() === 'q') {
        console.log('\nStopped early.');
        break;
      }
    }
  }

  if (!approved.length) { console.log('Nothing approved.'); return; }

  console.log(`\nPosting ${approved.length} tweet(s)...`);
  let posted = 0;
  for (const tweet of approved) {
    try {
      await postTweet(tweet);
      console.log(`✓ [${++posted}/${approved.length}] ${tweet.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`✗ Failed: ${err.message}`);
    }
  }
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync('progress.json', 'utf8')); }
  catch { return { lastChunk: 0, file: '', done: false }; }
}

function saveProgress(chunkIndex, file, done = false) {
  fs.writeFileSync('progress.json', JSON.stringify({ lastChunk: chunkIndex + 1, file, done }));
}

async function main() {
  console.log('\n🕰  TIME RECOVERED — My mind. Public. No edits.\n');

  const progress = loadProgress();
  const defaultFile = progress.file || 'Claude-1.txt';
  const fileInput = await ask(`File (default: ${defaultFile}): `);
  const INPUT_FILE = fileInput.trim() || defaultFile;

  if (!fs.existsSync(INPUT_FILE)) {
    console.log(`Not found: ${INPUT_FILE}`);
    rl.close(); return;
  }

  const text = fs.readFileSync(INPUT_FILE, 'utf8');
  console.log(`Loaded ${Math.round(text.length/1000)}K chars from ${INPUT_FILE}`);

  const chunks = chunkText(text, CHARS_PER_CHUNK);
  console.log(`${chunks.length} batches.`);

  let startChunk = 0;
  if (progress.file === INPUT_FILE && progress.lastChunk > 0 && !progress.done) {
    console.log(`Last run: batch ${progress.lastChunk} of ${chunks.length}`);
    const resume = await ask('Resume? (y/n): ');
    if (resume.toLowerCase() === 'y') startChunk = progress.lastChunk;
  }

  if (startChunk === 0) {
    const input = await ask('Batch 1? (y) or enter number: ');
    if (input.toLowerCase() !== 'y') startChunk = Math.max(0, parseInt(input)-1) || 0;
  }

  for (let i = startChunk; i < chunks.length; i++) {
    console.log(`\nGenerating batch ${i+1} of ${chunks.length}...`);
    let tweets;
    try {
      tweets = await generateTweets(chunks[i]);
    } catch (err) {
      console.error(`Failed: ${err.message}`);
      const skip = await ask('Skip? (y/n): ');
      if (skip.toLowerCase() === 'y') continue;
      else break;
    }

    await reviewAndPost(tweets, i);
    saveProgress(i, INPUT_FILE, i === chunks.length-1);

    if (i < chunks.length-1) {
      const cont = await ask('\nNext batch? (y/n): ');
      if (cont.toLowerCase() !== 'y') { console.log('Paused.'); break; }
    }
  }

  console.log('\n✓ Done. Time recovered.');
  rl.close();
}

main().catch(err => { console.error(err); rl.close(); process.exit(1); });
