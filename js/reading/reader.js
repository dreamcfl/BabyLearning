// ============================================================
// 阅读角 - 通用朗读播放器
// 负责：翻页状态、单页朗读、整本自动播放（绘本 / 故事 / 英语绘本 / 诗词通用）
// ============================================================

let _speechResolve = null;
let _playerToken = 0;

function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 语音不可用时，按文本长度估算朗读时长，保证自动播放节奏
function estimateSpeakSeconds(text, lang) {
  const isEnglish = lang && lang.indexOf('en') === 0;
  if (isEnglish) {
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(2, Math.min(15, words / 2.2));
  }
  const chars = text.replace(/\s/g, '').length;
  return Math.max(2, Math.min(15, chars / 4.5));
}

// 关闭当前朗读（手动翻页、退出时使用）
function stopReadingSpeech() {
  _playerToken++;
  if (_speechResolve) {
    const done = _speechResolve;
    _speechResolve = null;
    done();
  }
  if (typeof Speech !== 'undefined') Speech.stop();
  else if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// 语音不可用时，按估算时长等待，保证自动播放不会卡住
function sleepEstimate(text, lang) {
  return sleepMs(estimateSpeakSeconds(text, lang) * 1000);
}

// 朗读一段文本，返回可 await 的 Promise
function speakReading(text, lang) {
  const settings = typeof getSettings === 'function' ? getSettings() : {};
  const useSpeech = typeof Speech !== 'undefined' && Speech.supported;

  if (settings.voiceEnabled === false || !useSpeech) {
    return sleepEstimate(text, lang);
  }

  if (_speechResolve) {
    const done = _speechResolve;
    _speechResolve = null;
    done();
  }
  Speech.stop();

  return new Promise(resolve => {
    _speechResolve = resolve;
    const finish = () => {
      if (_speechResolve === resolve) {
        _speechResolve = null;
        resolve();
      }
    };

    Speech.speak(text, {
      lang: lang || 'zh-CN',
      rate: settings.speechRate || 0.85,
    }).then(ok => {
      if (!ok) {
        Speech.showHelp(Speech.lastError);
        // 自动播放时若持续无声，停止空转
        if (ReadingPlayer.auto) ReadingPlayer.stopAuto();
        finish();
        return sleepEstimate(text, lang).then(finish);
      }
      finish();
    }).catch(() => finish());
  });
}

const ReadingPlayer = {
  items: [],
  index: 0,
  lang: 'zh-CN',
  auto: false,
  onUpdate: null,
  getText: null,

  open(items, options = {}) {
    this.items = items || [];
    this.index = 0;
    this.auto = false;
    this.lang = options.lang || 'zh-CN';
    this.onUpdate = options.onUpdate || null;
    this.getText = options.getText || (item => item.text || item.main || item.en || '');
    _playerToken++;
    this.notify();
    if (options.autoSpeak) this.speakCurrent();
  },

  notify() {
    if (this.onUpdate) this.onUpdate(this.index, this.items.length);
  },

  current() {
    return this.items[this.index] || null;
  },
  hasNext() {
    return this.index < this.items.length - 1;
  },
  hasPrev() {
    return this.index > 0;
  },

  // 跳到指定页并朗读
  goTo(i) {
    this.stopAuto();
    if (i < 0 || i >= this.items.length) return;
    this.index = i;
    this.notify();
    this.speakCurrent();
  },

  next() {
    if (this.hasNext()) this.goTo(this.index + 1);
  },
  prev() {
    if (this.hasPrev()) this.goTo(this.index - 1);
  },

  speakCurrent() {
    const item = this.current();
    if (!item) return;
    const text = this.getText(item);
    if (text) speakReading(text, this.lang);
  },

  // 朗读另一语言（例如英语绘本的中文翻译）
  speakCurrentAlt(altGetter) {
    const item = this.current();
    if (!item) return;
    this.stopAuto();
    const text = altGetter(item);
    if (text) speakReading(text, 'zh-CN');
  },

  toggleAuto() {
    if (this.auto) {
      this.stopAuto();
      return;
    }
    this.startAuto();
  },

  async startAuto() {
    this.auto = true;
    const token = ++_playerToken;
    this.notify();

    while (this.auto && token === _playerToken && this.index < this.items.length) {
      const item = this.current();
      if (!item) break;
      const text = this.getText(item);
      if (text) await speakReading(text, this.lang);
      if (!this.auto || token !== _playerToken) break;
      await sleepMs(700);
      if (!this.auto || token !== _playerToken) break;
      if (!this.hasNext()) break;
      this.index++;
      this.notify();
    }

    if (token === _playerToken) {
      this.auto = false;
      this.notify();
    }
  },

  stopAuto() {
    this.auto = false;
    _playerToken++;
    if (_speechResolve) {
      const done = _speechResolve;
      _speechResolve = null;
      done();
    }
    if (typeof Speech !== 'undefined') Speech.stop();
    else if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.notify();
  },

  stopAll() {
    this.stopAuto();
    this.items = [];
    this.index = 0;
  },
};
