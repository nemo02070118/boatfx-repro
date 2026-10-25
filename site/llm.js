/* ==========================================================================
   BOAT · 00c the brain — a real language model, with this site's own
   instruments as its tools.
   --------------------------------------------------------------------------
   Two ways to get a brain, neither of which needs a server of ours:

     local    WebLLM + WebGPU: a real model runs inside the tab. One-time
              weight download, then zero network and zero keys — the same
              promise the rest of this page makes.
     byok     Any OpenAI-compatible endpoint (DeepSeek, OpenAI, Moonshot,
              OpenRouter, a local llama.cpp server…). The key is written to
              this browser's localStorage and is sent to nobody except the
              provider the visitor chose.

   Either way the model is not allowed to invent a number: every instrument
   on this page is exposed as a tool, and the answer's numbers must come
   back from a tool call. The tool trail is rendered exactly like the
   deterministic path's, so a reviewer can see which computation produced
   which figure.

   The chat interface is OpenAI-shaped (stream:true, tools, tool_calls) and
   WebLLM speaks the same shape, so one loop serves both backends.
   ========================================================================== */
(function () {
  "use strict";

  var LS_KEY = "hj-brain-v1";
  var MAX_ROUNDS = 6;        /* tool-calling rounds before we stop and answer */
  var KEEP_TURNS = 10;       /* conversation turns carried as context       */

  /* ------------------------------------------------------------- settings */
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }
  var state = load();
  /* never keep a key in a variable longer than this object's lifetime */

  var PROVIDERS = {
    none:     { label: "no brain — deterministic router", base: "", model: "", byok: false },
    deepseek: { label: "DeepSeek", base: "https://api.deepseek.com/v1", model: "deepseek-chat", byok: true },
    openai:   { label: "OpenAI", base: "https://api.openai.com/v1", model: "gpt-4o-mini", byok: true },
    custom:   { label: "OpenAI-compatible (custom)", base: "", model: "", byok: true },
    local:    { label: "in this browser (WebLLM)", base: "", model: "", byok: false }
  };

  /* Local models, by tier. WebLLM 0.2.86 supports native function calling
     ONLY on the Hermes family — every other model runs the intent bridge:
     natural-language instrument calls parsed by this page's own router.
     VRAM numbers are WebLLM's own prebuilt config. */
  var LOCAL_MODELS = [
    { id: "Qwen3-4B-Instruct-q4f16_1-MLC", label: "Qwen3 4B · ~3.4 GB · chat + intent bridge", tier: "mid" },
    { id: "Phi-4-mini-instruct-q4f16_1-MLC", label: "Phi-4-mini · ~3.4 GB · chat + intent bridge", tier: "mid" },
    { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", label: "Qwen2.5 3B · ~2.5 GB · chat + intent bridge", tier: "mid" },
    { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B · ~1.6 GB · chat + intent bridge", tier: "light" },
    { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B · ~1.1 GB · chat + intent bridge", tier: "light" },
    { id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC", label: "Hermes-3 Llama-3.1 8B · ~4.9 GB · native tool calling", tier: "heavy" }
  ];

  function get() { return state; }
  function set(patch) {
    for (var k in patch) if (patch.hasOwnProperty(k)) state[k] = patch[k];
    save(state);
    return state;
  }
  function clear() {
    state = {};
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    return state;
  }
  function active() {
    var p = state.provider;
    if (!p || p === "none") return null;
    if (p === "local") return { provider: p, model: state.model || LOCAL_MODELS[0].id };
    if (PROVIDERS[p] && PROVIDERS[p].byok && state.key) {
      return {
        provider: p,
        model: state.model || PROVIDERS[p].model,
        base: (p === "custom" ? state.base : PROVIDERS[p].base) || ""
      };
    }
    return null;
  }

  /* --------------------------------------------------------- conversation */
  var history = [];   /* {role, content} — kept short on purpose */

  function remember(role, content) {
    history.push({ role: role, content: content });
    if (history.length > KEEP_TURNS * 2) history = history.slice(-KEEP_TURNS * 2);
  }
  function resetChat() { history = []; }
  function context() { return history.slice(); }

  /* ------------------------------------------------------------ webllm */
  var mlc = null, mlcLoading = null;
  function localSupported() {
    return !!(navigator.gpu && navigator.gpu.requestAdapter);
  }
  /* The WebLLM module, from the first CDN that answers. esm.run and jsdelivr
     serve the same bundled build; unpkg serves the raw ESM package as a last
     resort. A failure here is a network failure, not a site failure — the
     message says so and points at BYOK. */
  var WEBLLM_CDNS = [
    "https://esm.run/@mlc-ai/web-llm@0.2.86",
    "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm",
    "https://unpkg.com/@mlc-ai/web-llm@0.2.86/lib/index.js"
  ];
  function importWebLLM() {
    var i = 0;
    function next() {
      if (i >= WEBLLM_CDNS.length) {
        return Promise.reject(new Error(
          "the WebLLM module could not be fetched from any CDN (esm.run, jsdelivr, unpkg) — " +
          "your network is blocking them. The instruments still run and your own key still works; " +
          "the local model needs that one file."));
      }
      var url = WEBLLM_CDNS[i++];
      return import(url).catch(function () { return next(); });
    }
    return next();
  }

  function loadLocal(modelId, onProgress) {
    var M = window.HJ_ML;
    if (!localSupported()) {
      return Promise.reject(new Error("this browser has no WebGPU — the local model needs it (Chrome/Edge 113+). Use your own key instead."));
    }
    if (mlc && mlc._id === modelId) return Promise.resolve(mlc);
    if (mlcLoading) return mlcLoading;
    mlcLoading = importWebLLM()
      .then(function (mod) {
        return mod.CreateMLCEngine(modelId, { initProgressCallback: onProgress });
      })
      .then(function (engine) {
        engine._id = modelId;
        mlc = engine;
        mlcLoading = null;
        return engine;
      })
      .catch(function (e) {
        mlcLoading = null;
        var msg = String((e && e.message) || e);
        if (/could not be fetched from any CDN/.test(msg)) throw new Error(msg);
        /* the module loaded; what failed is the weights */
        throw new Error("the model could not start: " + msg +
          " · the model file itself (~1.1–2 GB) downloads from huggingface.co when the engine starts — if that host is unreachable on your network, the local model cannot run here. Your own key is unaffected.");
      });
    return mlcLoading;
  }

  /* ------------------------------------------------- openai-compatible */
  /* One streaming request. Returns {content, toolCalls:[{id,name,args}]} */
  function streamChat(base, key, model, messages, tools, handlers) {
    var body = {
      model: model,
      messages: messages,
      stream: true,
      temperature: 0.2
    };
    if (tools && tools.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    var ctl = { aborted: false };
    var p = fetch(base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify(body),
      signal: handlers.signal
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("provider returned " + res.status + " — " + t.slice(0, 300));
        });
      }
      if (!res.body) throw new Error("this browser gave no response stream");
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = "", content = "", calls = [], finish = null;

      function handleLine(line) {
        if (!line || line.indexOf("data:") !== 0) return;
        var payload = line.slice(5).trim();
        if (payload === "[DONE]") { finish = finish || "stop"; return; }
        var j;
        try { j = JSON.parse(payload); } catch (e) { return; }
        var ch = j.choices && j.choices[0];
        if (!ch) return;
        if (ch.finish_reason) finish = ch.finish_reason;
        var d = ch.delta || {};
        if (d.content) {
          content += d.content;
          if (handlers.onToken) handlers.onToken(d.content);
        }
        if (d.tool_calls) {
          d.tool_calls.forEach(function (tc) {
            var i = tc.index == null ? 0 : tc.index;
            if (!calls[i]) calls[i] = { id: tc.id || ("call_" + i), name: "", args: "" };
            if (tc.id) calls[i].id = tc.id;
            if (tc.function && tc.function.name) calls[i].name += tc.function.name;
            if (tc.function && tc.function.arguments) calls[i].args += tc.function.arguments;
          });
        }
      }

      return (function pump() {
        return reader.read().then(function (r) {
          if (ctl.aborted) { try { reader.cancel(); } catch (e) {} return null; }
          if (r.done) {
            if (buf.trim()) { handleLine(buf.trim()); buf = ""; }
            return null;
          }
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split("\n");
          buf = lines.pop();
          lines.forEach(function (l) { handleLine(l.trim()); });
          return pump();
        });
      })().then(function () {
        /* assemble here: calls/content/finish live in this scope */
        var out = [];
        calls.forEach(function (c) {
          if (!c || !c.name) return;
          var args = {};
          try { args = c.args ? JSON.parse(c.args) : {}; } catch (e) { args = { _raw: c.args }; }
          out.push({ id: c.id, name: c.name, args: args });
        });
        return { content: content, toolCalls: out, finish: finish };
      });
    }).catch(function (e) {
      /* a dead endpoint, a CORS wall, an offline tab — name it, don't guess */
      if (e && e.name === "AbortError") throw e;
      if (e && e.name === "TypeError") {
        throw new Error("could not reach " + base + " — the endpoint is unreachable, offline, or blocking this page (CORS).");
      }
      throw e;
    });
    return p;
  }

  /* ------------------------------------------------------------- the loop */
  /* tools: [{name, description, parameters, run(args) -> {steps, blocks}}]
     Returns a promise of {text, calls:[{name,args,ms,result,error}]}       */
  function chat(opts) {
    var sys = opts.system || "";
    var tools = opts.tools || [];
    var onToken = opts.onToken;
    var onCall = opts.onCall;
    var a = active();
    if (!a) return Promise.reject(new Error("no brain configured"));

    var messages = [{ role: "system", content: sys }].concat(history).concat([
      { role: "user", content: opts.text }
    ]);
    var calls = [];

    function schemas() {
      return tools.map(function (t) {
        return {
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters || { type: "object", properties: {} }
          }
        };
      });
    }

    var round = 0;
    function oneRound() {
      round += 1;
      /* past MAX_ROUNDS the model stops getting tools: it must answer with
         what the instruments already returned, or say it cannot. */
      var allowTools = tools.length > 0 && round <= MAX_ROUNDS;
      var handlers = { onToken: onToken, signal: opts.signal };
      var req;
      if (a.provider === "local") {
        req = loadLocal(a.model, opts.onProgress).then(function (engine) {
          return engine.chat.completions.create({
            model: a.model, messages: messages, stream: true,
            tools: allowTools ? schemas() : undefined,
            tool_choice: allowTools ? "auto" : undefined,
            temperature: 0.2
          }).then(function (chunk) {
            /* WebLLM returns an async iterable of the same delta shape */
            var content = "", callsRaw = [];
            function pump(it) {
              var r = it.next();
              if (r.done) return Promise.resolve();
              return Promise.resolve(r.value).then(function (j) {
                var ch = j.choices && j.choices[0];
                var d = ch && (ch.delta || {});
                if (d && d.content) { content += d.content; if (onToken) onToken(d.content); }
                if (d && d.tool_calls) {
                  d.tool_calls.forEach(function (tc) {
                    var i = tc.index == null ? 0 : tc.index;
                    if (!callsRaw[i]) callsRaw[i] = { id: tc.id || ("call_" + i), name: "", args: "" };
                    if (tc.id) callsRaw[i].id = tc.id;
                    if (tc.function && tc.function.name) callsRaw[i].name += tc.function.name;
                    if (tc.function && tc.function.arguments) callsRaw[i].args += tc.function.arguments;
                  });
                }
                return pump(it);
              });
            }
            return pump(chunk[Symbol.asyncIterator]()).then(function () {
              var out = [];
              callsRaw.forEach(function (c) {
                if (!c || !c.name) return;
                var args = {};
                try { args = c.args ? JSON.parse(c.args) : {}; } catch (e) { args = { _raw: c.args }; }
                out.push({ id: c.id, name: c.name, args: args });
              });
              return { content: content, toolCalls: out };
            });
          });
        });
      } else {
        req = streamChat(a.base, state.key, a.model, messages, allowTools ? schemas() : [], handlers);
      }

      return req.then(function (res) {
        if (res.toolCalls && res.toolCalls.length && allowTools) {
          /* the model asked for instruments — run them, all of them */
          var assistant = { role: "assistant", content: res.content || null, tool_calls: res.toolCalls.map(function (c) {
            return { id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } };
          }) };
          messages.push(assistant);
          return res.toolCalls.reduce(function (chain, call) {
            return chain.then(function () {
              var tool = null;
              tools.forEach(function (t) { if (t.name === call.name) tool = t; });
              if (!tool) {
                messages.push({ role: "tool", tool_call_id: call.id,
                  content: JSON.stringify({ error: "no such instrument: " + call.name }) });
                return null;
              }
              var t0 = (window.performance && performance.now) ? performance.now() : 0;
              var out;
              try { out = tool.run(call.args || {}); }
              catch (e) { out = { steps: [], blocks: [{ k: "verdict", tone: "no",
                h: "the instrument threw", b: String(e && e.message || e) }] }; }
              var ms = Math.max(0, Math.round(((window.performance && performance.now ? performance.now() : 0) - t0) * 100) / 100);
              var rec = { name: call.name, args: call.args, ms: ms, result: out, error: null };
              calls.push(rec);
              if (onCall) onCall(rec);
              /* the model gets the computed facts, never the block layout */
              messages.push({ role: "tool", tool_call_id: call.id, content: digest(out) });
              return null;
            });
          }, Promise.resolve()).then(function () { return oneRound(); });
        }
        return { text: res.content || "", calls: calls };
      });
    }

    return oneRound().then(function (final) {
      remember("user", opts.text);
      remember("assistant", final.text || "(no text)");
      return final;
    });
  }

  /* the numbers an instrument computed, as compact JSON for the model */
  function digest(out) {
    var facts = { steps: (out.steps || []).map(function (s) {
      return { call: s.name, args: s.args, ms: s.ms, status: s.status, detail: s.detail };
    }) };
    (out.blocks || []).forEach(function (b) {
      if (b.k === "kv") facts[b.k] = b.items;
      else if (b.k === "table") facts.table = { head: (b.head || []).map(function (h) { return h.t; }),
        rows: (b.rows || []).map(function (r) { return r.map(function (c) { return c.t; }); }) };
      else if (b.k === "verdict") facts.verdict = { tone: b.tone, headline: b.h, body: b.b };
      else if (b.k === "bars") facts.bars = b.items;
      else if (b.k === "math") facts.math = (b.lines || []).map(function (l) { return l.t; });
      else if (b.k === "prose" || b.k === "note") facts[b.k] = b.text;
    });
    return JSON.stringify(facts).slice(0, 6000);
  }

  /* ------------------------------------------------------------- exports */
  window.HJ_LLM = {
    version: "v1.0",
    providers: PROVIDERS,
    localModels: LOCAL_MODELS,
    get: get,
    set: set,
    clear: clear,
    active: active,
    localSupported: localSupported,
    loadLocal: loadLocal,
    chat: chat,
    resetChat: resetChat,
    context: context,
    MAX_ROUNDS: MAX_ROUNDS
  };
})();
