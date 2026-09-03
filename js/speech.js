// ============================================================
// 统一语音（TTS）引擎封装
// 解决安卓 / HarmonyOS（华为等）设备上 speechSynthesis 无声问题：
//   1. 用户手势解锁：安卓要求首次 speak 必须在手势上下文中
//   2. getVoices() 异步加载：华为首次返回空数组
//   3. cancel() 后延迟再 speak：规避安卓静默失败
//   4. 静默失败检测：既不 onstart 也不 onerror 时判定失败
//   5. 长文本分块：规避约 15 秒自动截断
//   6. 中文语音优先匹配
// 依赖：无。需在 utils.js 之前引入。
// ============================================================

const Speech = {
  supported: false,
  voices: [],
  ready: false,
  unlocked: false,
  lastError: null,
  _watchdog: null,
  _helpAt: 0,

  // ---------------------- 初始化 ----------------------
  init() {
    this.supported = !!(
      window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
    if (!this.supported) return;

    this.loadVoices();

    // 标准事件：语音列表异步到达
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }

    // 轮询兜底：华为部分浏览器不触发 voiceschanged
    let tries = 0;
    const timer = setInterval(() => {
      this.loadVoices();
      if (this.ready || ++tries > 25) clearInterval(timer);
    }, 400);

    // 用户手势解锁：首次交互时激活引擎
    const events = ['touchstart', 'click', 'pointerdown', 'keydown'];
    const unlockOnce = () => {
      this.unlock();
      this.loadVoices();
      events.forEach(ev => window.removeEventListener(ev, unlockOnce, true));
    };
    events.forEach(ev => window.addEventListener(ev, unlockOnce, true));

    // 页面重新可见时补一次解锁
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this.unlock(); this.loadVoices(); }
    });
  },

  loadVoices() {
    if (!this.supported) return [];
    let vs = [];
    try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    if (vs.length) {
      this.voices = vs;
      this.ready = true;
    }
    return vs;
  },

  // 静音朗读一次空内容，用于激活引擎（必须在用户手势中调用）
  unlock() {
    if (!this.supported || this.unlocked) return;
    try {
      const u = new window.SpeechSynthesisUtterance('\u3002');
      u.volume = 0;
      u.rate = 2;
      window.speechSynthesis.speak(u);
      this.unlocked = true;
    } catch (e) { /* 忽略 */ }
  },

  // ---------------------- 语音选择 ----------------------
  pickVoice(lang) {
    if (!this.voices.length) return null;
    const target = String(lang || '').toLowerCase().replace('_', '-');
    const prefix = target.split('-')[0];

    // 精确匹配（zh-cn）
    let v = this.voices.find(x =>
      String(x.lang || '').toLowerCase().replace('_', '-') === target);
    if (v) return v;

    // 前缀匹配（zh / en）
    v = this.voices.find(x =>
      String(x.lang || '').toLowerCase().replace('_', '-').startsWith(prefix));
    return v || null;
  },

  // ---------------------- 长文本分块 ----------------------
  splitText(text, max = 80) {
    const s = String(text || '').trim();
    if (!s) return [];
    if (s.length <= max) return [s];

    const chunks = [];
    let buf = '';
    for (const ch of s) {
      buf += ch;
      const isBreak = /[，。！？；：、,.!?;:"]/.test(ch);
      if (buf.length >= max && isBreak) {
        chunks.push(buf);
        buf = '';
      } else if (buf.length >= max * 1.6) {
        // 没有标点也要强切，避免超长
        chunks.push(buf);
        buf = '';
      }
    }
    if (buf) chunks.push(buf);
    return chunks;
  },

  // ---------------------- 朗读 ----------------------
  // 返回 Promise<boolean>：true 正常发声，false 未发声（静默失败等）
  async speak(text, opts = {}) {
    const lang = opts.lang || 'zh-CN';
    const rate = opts.rate || 0.85;
    const chunks = this.splitText(text);
    if (!chunks.length) return true;

    if (!this.supported) {
      this.lastError = 'not-supported';
      if (opts.onfail) opts.onfail(this.lastError);
      return false;
    }

    // 尝试解锁（在手势上下文中调用才真正生效）
    this.unlock();

    for (let i = 0; i < chunks.length; i++) {
      const ok = await this._speakChunk(chunks[i], lang, rate, opts, i === 0);
      if (!ok) {
        if (opts.onfail) opts.onfail(this.lastError);
        return false;
      }
    }
    return true;
  },

  _speakChunk(text, lang, rate, opts, isFirst) {
    return new Promise(resolve => {
      let settled = false;
      let started = false;

      const done = ok => {
        if (settled) return;
        settled = true;
        clearTimeout(this._watchdog);
        resolve(ok);
      };

      try {
        const synth = window.speechSynthesis;

        // 先停止之前的；安卓上 cancel 后需延迟再 speak，否则静默失败
        if (synth.speaking || synth.pending) synth.cancel();
        const delay = isFirst || synth.speaking || synth.pending ? 90 : 0;

        setTimeout(() => {
          if (settled) return;
          const u = new window.SpeechSynthesisUtterance(text);
          u.lang = lang;
          u.rate = rate;
          u.volume = 1;
          u.pitch = 1.05;
          // 统一使用系统默认语音，与宝宝识字台保持一致
          // const v = this.pickVoice(lang);
          // if (v) u.voice = v;

          u.onstart = () => {
            started = true;
            this.lastError = null;
            if (opts.onstart) opts.onstart();
          };
          u.onend = () => done(true);
          u.onerror = e => {
            this.lastError = (e && e.error) || 'error';
            done(false);
          };
          synth.speak(u);
        }, delay);
      } catch (e) {
        this.lastError = 'exception';
        done(false);
      }

      // 看门狗：迟迟未开始即判定静默失败（华为常见）
      const budget = Math.max(1500, text.length * 120);
      this._watchdog = setTimeout(() => {
        if (!settled && !started) {
          this.lastError = 'timeout-no-start';
          done(false);
        }
      }, budget);
    });
  },

  stop() {
    if (this.supported) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
    }
  },

  // ---------------------- 诊断 ----------------------
  diagnose() {
    return {
      supported: this.supported,
      ready: this.ready,
      unlocked: this.unlocked,
      voiceCount: this.voices.length,
      hasChinese: !!this.pickVoice('zh-CN'),
      hasEnglish: !!this.pickVoice('en-US'),
      chineseVoice: (this.pickVoice('zh-CN') || {}).name || '',
      lastError: this.lastError,
      harmony: /harmony|huawei|honor/i.test(navigator.userAgent || ''),
    };
  },

  // 实测朗读，返回 Promise<{ok, reason}>
  test() {
    return new Promise(resolve => {
      if (!this.supported) return resolve({ ok: false, reason: 'not-supported' });
      this.speak('宝宝，你好呀', {
        lang: 'zh-CN',
        rate: 0.9,
      }).then(ok => resolve({ ok, reason: this.lastError }));
    });
  },

  // ---------------------- 失败提示 ----------------------
  // 同一原因 60 秒内只提示一次，避免自动播放时反复弹
  showHelp(reason) {
    const now = Date.now();
    if (now - this._helpAt < 60000) return;
    this._helpAt = now;

    const isHarmony = /harmony|huawei|honor/i.test(navigator.userAgent || '');
    let msg;
    if (reason === 'not-supported') {
      msg = '当前浏览器不支持语音朗读，建议换用 <b>Chrome / 华为浏览器</b> 打开。';
    } else if (!this.ready || !this.pickVoice('zh-CN')) {
      msg = '没有找到中文语音引擎。请到手机「设置 › 系统和更新 › 语言和输入法 › 文本转语音」中安装中文语音。'
        + (isHarmony ? '<br><small>华为设备首发音箱图标后需等待语音数据下载完成</small>' : '');
    } else {
      msg = '语音没有启动。请<b>先点一下屏幕任意位置</b>再试，并确认手机没有处于静音或勿扰模式。';
    }

    let el = document.getElementById('speechToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'speechToast';
      el.style.cssText =
        'position:fixed;left:16px;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));'
        + 'background:rgba(0,0,0,0.86);color:#fff;padding:14px 16px;border-radius:14px;'
        + 'font-size:0.85rem;line-height:1.6;z-index:900;text-align:center;'
        + 'box-shadow:0 8px 24px rgba(0,0,0,0.25);transition:opacity .3s;';
      document.body.appendChild(el);
    }
    el.innerHTML = '🔇 听不到声音？<br>' + msg
      + '<div style="margin-top:10px;font-size:0.78rem;opacity:0.7">点击此提示可关闭</div>';
    el.style.display = 'block';
    el.style.opacity = '1';
    el.onclick = () => { el.style.display = 'none'; };

    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 9000);
  },
};

Speech.init();
