# Mew-1A v4.2 Streaming Chat UI

**Production-grade chat interface for Mew-1A v4.2 with real-time SSE streaming**

Following [NanoChat](https://github.com/karpathy/nanochat)'s architecture patterns for minimal, fast, and production-ready LLM serving.

---

## Features

### ChatGPT-Style Streaming
- **Real-time token streaming** via Server-Sent Events (SSE)
- **Token-by-token rendering** for smooth UX (no waiting for full response)
- **Live metrics display** (tokens, speed, latency)
- **Connection health monitoring** with automatic status updates

### Vanilla JavaScript (No Framework Bloat)
- **Zero dependencies** - pure HTML/CSS/JS following NanoChat pattern
- **< 500 lines total** - simple, readable, maintainable
- **Fast load time** - no webpack, no node_modules, instant startup
- **Works anywhere** - just open in browser, no build step needed

### Production-Ready UX
- **Dark mode optimized** for long sessions
- **Example prompts** for quick testing
- **Keyboard shortcuts** (Enter to send, Shift+Enter for newline)
- **Auto-scroll** to latest message
- **Error handling** with graceful degradation
- **Responsive design** works on desktop and mobile

---

## Quick Start

### 1. Start Local Server

```bash
cd apps/mew1a-chat
python3 -m http.server 8001
```

### 2. Open in Browser

Navigate to: **http://localhost:8001/chat.html**

### 3. Try Example Prompts

Click any example button or type your own:

- **"Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%"**
- **"BUY or PASS? Pikachu VMAX - Listed $120, Fair Value $95, trending down 12%"**
- **"What is the market trend for Umbreon VMAX cards?"**

---

## Architecture

### Files

```
apps/mew1a-chat/
├── chat.html              # Main streaming UI (vanilla JS)
├── index.html             # Legacy simple UI (deprecated)
└── README.md              # This file
```

### How Streaming Works

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Browser   │         │  Modal Endpoint  │         │  vLLM GPU   │
│  (chat.html)│─────────│  (FastAPI SSE)   │─────────│ (Streaming) │
└─────────────┘         └──────────────────┘         └─────────────┘
       │                         │                          │
       │  1. Send prompt         │                          │
       ├────────────────────────>│                          │
       │                         │  2. Load model           │
       │                         ├─────────────────────────>│
       │                         │                          │
       │  3. SSE stream opens    │  4. Generate tokens      │
       │<────────────────────────┤<─────────────────────────│
       │                         │                          │
       │  Token 1                │                          │
       │<────────────────────────┤                          │
       │  Token 2                │                          │
       │<────────────────────────┤                          │
       │  Token 3                │                          │
       │<────────────────────────┤                          │
       │  ...                    │                          │
       │  Done + metrics         │                          │
       │<────────────────────────┤                          │
```

### Event Flow

1. **Health Check** (every 30s)
   - Checks server status via `/health` endpoint
   - Updates connection indicator
   - Displays model name and uptime

2. **User Sends Prompt**
   - User types prompt or clicks example
   - Presses Enter or clicks "Send" button
   - UI disables input during streaming

3. **SSE Connection Opens**
   - Browser creates EventSource with prompt in URL params
   - Server starts streaming tokens immediately
   - No buffering - tokens appear as generated

4. **Tokens Stream In**
   - Each token arrives via SSE message
   - UI appends token to message in real-time
   - Scroll position follows latest token

5. **Stream Completes**
   - Server sends "done" signal
   - UI displays final metrics (time, tokens, speed)
   - Input re-enabled for next message

---

## Configuration

### Change Model Endpoint

Edit the `CONFIG` object in [chat.html](chat.html):

```javascript
const CONFIG = {
  API_URL: 'https://your-modal-endpoint.modal.run',
  HEALTH_URL: 'https://your-health-endpoint.modal.run',
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
};
```

### Adjust Inference Parameters

Modify the URL parameters in the `sendMessage()` function:

```javascript
url.searchParams.append('max_tokens', '300');      // More tokens
url.searchParams.append('temperature', '0.7');     // More creative
url.searchParams.append('top_p', '0.95');          // Nucleus sampling
```

---

## TypeScript Client

For programmatic access, use the TypeScript SSE client:

```typescript
import { streamMew1A } from '../ml/src/clients/mew1a-streaming';

await streamMew1A(
  'Analyze: Charizard ex - Listed $45',
  (token, done, metrics) => {
    if (done) {
      console.log(`\nComplete! ${metrics.totalTokens} tokens`);
    } else {
      process.stdout.write(token);
    }
  }
);
```

See [test-streaming-client.ts](../../scripts/test-streaming-client.ts) for full examples.

---

## Deployment

### Option 1: Static Hosting

Since it's vanilla JS with no build step, deploy anywhere:

```bash
# Vercel
vercel apps/mew1a-chat

# Netlify
netlify deploy --dir=apps/mew1a-chat

# GitHub Pages
# Just commit and enable GitHub Pages on the repo
```

### Option 2: Add to Main App

Integrate the streaming client into your existing React/Next.js app:

```typescript
import { createMew1AClient } from '@/ml/clients/mew1a-streaming';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const client = createMew1AClient();

  const handleSend = async (prompt: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);

    // Stream assistant response
    let assistantMessage = '';
    await client.stream(
      prompt,
      (token, done) => {
        if (!done) {
          assistantMessage += token;
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: assistantMessage }
          ]);
        }
      }
    );
  };

  return <ChatUI messages={messages} onSend={handleSend} />;
}
```

---

## NanoChat Patterns Extracted

This implementation follows these key patterns from [Karpathy's NanoChat](https://github.com/karpathy/nanochat):

### 1. Server-Sent Events (SSE)
- **Why**: More efficient than WebSockets for one-way streaming
- **How**: EventSource API with URL-encoded parameters
- **Benefit**: Works through proxies, auto-reconnects, simpler protocol

### 2. Vanilla JavaScript
- **Why**: Zero build time, zero dependencies, maximum compatibility
- **How**: Plain DOM manipulation, no React/Vue/Angular
- **Benefit**: Loads instantly, works forever, easy to debug

### 3. FastAPI Lifespan Management
- **Why**: Load model once, reuse across requests (vLLM pattern)
- **How**: `@modal.enter()` decorator loads model on container start
- **Benefit**: Sub-second inference after cold start

### 4. Health Check Endpoint
- **Why**: Monitor model status, detect failures early
- **How**: `/health` endpoint returns model state + metrics
- **Benefit**: User sees connection status in real-time

### 5. Metrics Display
- **Why**: Transparency and debugging (following NanoChat's report.md pattern)
- **How**: Show tokens, time, speed after each generation
- **Benefit**: Users can verify model performance

---

## Troubleshooting

### "Disconnected" Status

**Problem**: Status dot is red, shows "Disconnected"

**Solutions**:
1. Check Modal deployment is running: `modal app list`
2. Verify health endpoint is accessible: `curl [HEALTH_URL]`
3. Check CORS settings in streaming server
4. Ensure HuggingFace token is valid (for model download)

### "Model loading..." Forever

**Problem**: Health check passes but model never loads

**Solutions**:
1. Check Modal logs: `modal app logs mew1a-v42-streaming-model`
2. Verify GPU availability (T4 may be out of capacity)
3. Check HuggingFace model permissions (Llama 3.2 requires acceptance)
4. Increase Modal timeout in deployment config

### No Tokens Streaming

**Problem**: Connection works, but no tokens appear

**Solutions**:
1. Check browser console for SSE errors
2. Verify API_URL in CONFIG matches Modal endpoint
3. Test non-streaming endpoint first: `/generate`
4. Check prompt formatting (model expects specific format)

### Slow Streaming

**Problem**: Tokens appear, but very slowly (< 1 tok/s)

**Solutions**:
1. Verify using T4 GPU (not CPU)
2. Check vLLM config: `gpu_memory_utilization` should be 0.9
3. Enable KV cache in vLLM
4. Reduce `max_model_len` if OOM errors

---

## Performance Benchmarks

**Hardware**: Modal T4 GPU (16GB VRAM)
**Model**: ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing (3B params + LoRA)
**Quantization**: bfloat16 (no quantization)

| Metric | Value |
|--------|-------|
| Cold Start | ~60s (model download + load) |
| Warm Inference | 3-7s per request |
| Tokens/Second | 15-25 tok/s |
| Concurrent Requests | Up to 3 (T4 16GB VRAM) |
| Cost | $0.00015/sec GPU time |

**Comparison to v1 (Transformers)**:
- **2-3x faster** token generation
- **Streaming enabled** (v1 had no streaming)
- **Better concurrency** (vLLM batching)
- **Lower latency** (persistent model in memory)

---

## Next Steps

Following the [NanoChat Upgrade Roadmap](../../docs/architecture/NANOCHAT-UPGRADE-ROADMAP.md):

### Phase 1: Streaming & UX Upgrade (Current)
- [x] SSE streaming server
- [x] Vanilla JS UI
- [x] TypeScript SSE client
- [ ] Deployment to production

### Phase 2: Evaluation Framework (Next)
- [ ] Pokemon TCG evaluation suite (ARC/MMLU equivalent)
- [ ] Automated quality reports (like NanoChat's report.md)
- [ ] Continuous evaluation pipeline

### Phase 3: Monitoring & Observability
- [ ] Performance dashboard
- [ ] Alerting for failures
- [ ] Cost tracking

---

## Contributing

This UI is intentionally minimal. Keep it that way!

**Guidelines**:
- No frameworks (React, Vue, etc.)
- No build step required
- Keep total size under 1000 lines
- Follow NanoChat's simplicity philosophy
- Comment any non-obvious code

**To improve**:
1. Fork repo
2. Edit `chat.html` directly
3. Test in browser (no build needed!)
4. Submit PR with description

---

## References

- **NanoChat**: https://github.com/karpathy/nanochat (Karpathy's reference implementation)
- **vLLM**: https://docs.vllm.ai/ (High-performance inference engine)
- **Modal**: https://modal.com/docs (Serverless GPU platform)
- **SSE Spec**: https://html.spec.whatwg.org/multipage/server-sent-events.html

---

Built with inspiration from **Andrej Karpathy's NanoChat** - proving that the best tools are often the simplest.
