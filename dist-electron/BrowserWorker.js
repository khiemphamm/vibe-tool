"use strict";var M=Object.create;var v=Object.defineProperty;var S=Object.getOwnPropertyDescriptor;var A=Object.getOwnPropertyNames;var E=Object.getPrototypeOf,T=Object.prototype.hasOwnProperty;var W=(e,t,r,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let c of A(t))!T.call(e,c)&&c!==r&&v(e,c,{get:()=>t[c],enumerable:!(o=S(t,c))||o.enumerable});return e};var C=(e,t,r)=>(r=e!=null?M(E(e)):{},W(t||!e||!e.__esModule?v(r,"default",{value:e,enumerable:!0}):r,e));const b=require("node:worker_threads");function $(e){var t;(t=b.parentPort)==null||t.postMessage(e)}function i(e,t){$({type:"log",payload:{level:e,message:t}})}function u(e){var r;const t={id:a.id,state:"idle",proxy:((r=a.proxy)==null?void 0:r.server)??null,userAgent:a.fingerprint.userAgent,uptime:0,lastHeartbeat:Date.now(),error:null,...e};$({type:"status",payload:t})}const a=b.workerData,g=Date.now();function I(e){return`
    (() => {
      const fp = ${JSON.stringify(e)};

      // ── Navigator overrides ──
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
      Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => [fp.language, fp.language.split('-')[0]] });

      // Fake plugin array (empty = headless detection flag)
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ];
          arr.length = 3;
          return arr;
        }
      });

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          const arr = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          ];
          arr.length = 1;
          return arr;
        }
      });

      // ── Permissions API override ──
      const origQuery = Permissions.prototype.query;
      Permissions.prototype.query = function(desc) {
        if (desc.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null });
        }
        return origQuery.call(this, desc);
      };

      // ── WebGL fingerprint ──
      try {
        const origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return fp.webglVendor;
          if (param === 0x9246) return fp.webglRenderer;
          return origGetParameter.call(this, param);
        };
        if (typeof WebGL2RenderingContext !== 'undefined') {
          const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 0x9245) return fp.webglVendor;
            if (param === 0x9246) return fp.webglRenderer;
            return origGetParameter2.call(this, param);
          };
        }
      } catch(e) {}

      // ── Chrome runtime stub (missing in headless = detection vector) ──
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          connect: function() {},
          sendMessage: function() {},
        };
      }

      // ── iframe contentWindow detection bypass ──
      const origHTMLIFrameElement = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      if (origHTMLIFrameElement) {
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: function() {
            const w = origHTMLIFrameElement.get.call(this);
            if (w) {
              try { w.chrome = window.chrome; } catch(e) {}
            }
            return w;
          }
        });
      }
    })();
  `}async function R(){var e;try{u({state:"connecting"}),i("info",`Worker ${a.id} starting — target: ${a.targetUrl}`);const{chromium:t}=await import("playwright-core"),r={headless:!0,args:["--disable-blink-features=AutomationControlled","--disable-features=IsolateOrigins,site-per-process","--autoplay-policy=no-user-gesture-required","--disable-background-media-suspend","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-dev-shm-usage","--no-sandbox","--disable-setuid-sandbox",`--window-size=${a.fingerprint.viewport.width},${a.fingerprint.viewport.height}`]};a.proxy&&(r.proxy=a.proxy);const o=await t.launch(r),c=await o.newContext({userAgent:a.fingerprint.userAgent,viewport:a.fingerprint.viewport,locale:a.fingerprint.language,timezoneId:a.fingerprint.timezone,ignoreHTTPSErrors:!0,permissions:["camera","microphone"],bypassCSP:!0,colorScheme:"dark"});await c.addInitScript(I(a.fingerprint));const d=await c.newPage();await d.route("**/*",n=>{const s=n.request().resourceType(),m=n.request().url();return s==="font"||["google-analytics.com","googletagmanager.com","facebook.net/tr","doubleclick.net","adservice.google"].some(x=>m.includes(x))?n.abort():n.continue()}),i("info",`Worker ${a.id} navigating to ${a.targetUrl}`);const p=[3e4,45e3,6e4];let w=!1;for(let n=0;n<p.length;n++)try{await d.goto(a.targetUrl,{waitUntil:"domcontentloaded",timeout:p[n]}),w=!0,n>0&&i("info",`Worker ${a.id} navigation succeeded on attempt ${n+1}`);break}catch(s){const m=s instanceof Error?s.message:String(s);if(n<p.length-1)i("warn",`Worker ${a.id} nav attempt ${n+1} failed: ${m.slice(0,80)} — retrying...`),await l(2e3);else{const h=a.proxy?` (proxy: ${a.proxy.server})`:" (no proxy)";throw new Error(`Navigation failed after ${p.length} attempts${h}: ${m.slice(0,120)}`)}}if(!w)return;await L(d);try{await d.waitForSelector("video",{timeout:15e3}),i("info",`Worker ${a.id} video element detected`)}catch{i("warn",`Worker ${a.id} no video element found — continuing anyway`)}await l(5e3);const f=await P(d);u({state:f?"active":"stalled",uptime:Math.round((Date.now()-g)/1e3),lastHeartbeat:Date.now()}),i(f?"success":"warn",`Worker ${a.id} session ${f?"active — media engaged":"stalled — video not playing"}`);const k=2e4+Math.random()*1e4;let y=!0;for((e=b.parentPort)==null||e.on("message",async n=>{n.type==="stop"&&(y=!1,i("info",`Worker ${a.id} received stop signal`),await o.close().catch(()=>{}),u({state:"stopped",uptime:Math.round((Date.now()-g)/1e3)}),process.exit(0))});y;){const n=k+(Math.random()-.5)*5e3;if(await l(n),!y)break;try{await D(d);const s=await P(d);u({state:s?"active":"stalled",uptime:Math.round((Date.now()-g)/1e3),lastHeartbeat:Date.now()})}catch(s){i("warn",`Worker ${a.id} heartbeat error: ${s instanceof Error?s.message:String(s)}`)}}}catch(t){const r=t instanceof Error?t.message:String(t);i("error",`Worker ${a.id} fatal: ${r}`),u({state:"error",error:r,uptime:Math.round((Date.now()-g)/1e3)})}}async function P(e){for(let r=0;r<3;r++)try{await O(e),await j(e);const o=await e.evaluate(`
        (() => {
          const videos = document.querySelectorAll('video');
          for (const v of videos) {
            if (v.paused) {
              v.muted = true;
              v.play().catch(() => {});
            }
          }
          const playing = Array.from(videos).some(v => !v.paused && v.readyState > 2);
          return {
            count: videos.length,
            playing,
            readyState: videos[0] ? videos[0].readyState : -1,
            paused: videos[0] ? videos[0].paused : true,
            currentTime: videos[0] ? videos[0].currentTime : 0,
          };
        })()
      `);if(o&&o.playing)return i("success",`Worker ${a.id} ▶ video playing (time: ${Math.round(o.currentTime)}s)`),!0;if(o&&!o.playing&&r<2){i("info",`Worker ${a.id} play attempt ${r+1}/3 — paused:${o.paused} ready:${o.readyState}`),await l(2e3+r*1e3);continue}i("warn",`Worker ${a.id} video not playing after 3 attempts (paused:${o==null?void 0:o.paused} ready:${o==null?void 0:o.readyState})`)}catch{}return!1}async function j(e){const t=[".ytp-large-play-button",".ytp-play-button",'button[aria-label="Play (k)"]','button[data-title-no-tooltip="Play"]',".vjs-big-play-button",".vjs-play-control",'[aria-label="Play"]','[aria-label="play"]','button[class*="play" i]','[data-testid*="play" i]',"video"];for(const r of t)try{const o=e.locator(r).first();if(await o.isVisible({timeout:1e3})){await o.click({force:!0,timeout:2e3}),await l(500);return}}catch{}}async function O(e){const t=[".ytp-ad-skip-button",".ytp-ad-skip-button-modern","button.ytp-ad-overlay-close-button",".ytp-ad-skip-button-slot button","#dismiss-button","tp-yt-paper-dialog #dismiss-button","yt-button-renderer#dismiss-button",".yt-mealbar-promo-renderer button",'button[aria-label="Yes, proceed"]','[aria-label="Close"]',".modal-close",".popup-close-button"];for(const r of t)try{const o=e.locator(r).first();await o.isVisible({timeout:500})&&(await o.click({force:!0,timeout:1e3}),i("info",`Worker ${a.id} dismissed overlay: ${r}`),await l(300))}catch{}}async function D(e){const t=Math.random();try{if(t<.3){const r=100+Math.random()*800,o=100+Math.random()*500;await e.mouse.move(r,o,{steps:5+Math.floor(Math.random()*10)})}else if(t<.5)await e.evaluate(`window.scrollBy(0, ${Math.random()*60-30})`);else if(t<.6){const r=e.viewportSize();r&&await e.mouse.move(r.width/2,r.height/2,{steps:8})}else await l(1e3+Math.random()*2e3)}catch{}}async function L(e){const t=['button[id*="accept"]','button[class*="accept"]','button[id*="consent"]','button[class*="consent"]','[data-testid*="accept"]','button:has-text("Accept")','button:has-text("Accept All")','button:has-text("I Agree")','button:has-text("OK")','button:has-text("Got it")','button:has-text("Agree")','button:has-text("Allow")','button:has-text("Continue")','[aria-label="Close"]','[aria-label="close"]',".modal-close",".popup-close"];for(const r of t)try{const o=e.locator(r).first();if(await o.isVisible({timeout:1500})){await o.click(),i("info",`Worker ${a.id} dismissed overlay: ${r}`),await l(500);return}}catch{}}function l(e){return new Promise(t=>setTimeout(t,e))}R();
