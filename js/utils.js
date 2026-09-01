// ============================================================
// 宝宝学习台 - 共享工具库
// 三科（识字/英语/数学）+ 家长端共用
// ============================================================

const PREFIX = 'BabyLearning_';

// ---------------------- localStorage 读写 ----------------------
function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn('storageGet error', key, e);
    return defaultValue;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('storageSet error', key, e);
  }
}

// ---------------------- 旧版数据迁移 ----------------------
function migrateLegacyData() {
  if (storageGet('chinese')) return;

  const migrated = {};
  const legacyMap = {
    chineseProgress: 'progress',
    chineseToday: 'today',
    chineseStreak: 'streak',
    chineseSettings: 'settings',
  };

  let hasLegacy = false;
  Object.entries(legacyMap).forEach(([oldKey, newProp]) => {
    const raw = localStorage.getItem(oldKey);
    if (raw !== null) {
      try {
        migrated[newProp] = JSON.parse(raw);
        hasLegacy = true;
      } catch (e) {
        migrated[newProp] = raw;
        hasLegacy = true;
      }
    }
  });

  if (hasLegacy) {
    storageSet('chinese', migrated);
    // 不删除旧 key，防止意外丢失
  }
}

// ---------------------- 孩子档案 / 积分 ----------------------
function getProfile() {
  return storageGet('profile', {
    points: 0,
    streak: 0,
    lastLearnDate: '',
    nickname: '宝宝',
  });
}

function saveProfile(profile) {
  storageSet('profile', profile);
}

function addPoints(amount, reason = '') {
  const profile = getProfile();
  profile.points += amount;
  if (reason) {
    profile.lastReason = reason;
  }
  saveProfile(profile);
  updatePointsUI();
  return profile.points;
}

function updateStreak() {
  const profile = getProfile();
  const today = formatDate(new Date());
  if (profile.lastLearnDate === today) return profile.streak;

  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (profile.lastLearnDate === yesterday) {
    profile.streak += 1;
  } else if (profile.lastLearnDate !== today) {
    profile.streak = 1;
  }
  profile.lastLearnDate = today;
  saveProfile(profile);
  updateStreakUI();
  return profile.streak;
}

// ---------------------- 学科数据 ----------------------
function getSubjectData(subject) {
  const defaults = {
    chinese: { progress: {}, today: {}, streak: {}, settings: { dailyCount: 5 } },
    english: { learned: {}, gameStats: { listen: 0, spell: 0, match: 0 }, settings: { dailyCount: 5 } },
    math: { stats: { count: 0, compare: 0, addsub: 0, shape: 0, correct: 0, total: 0 }, settings: { dailyCount: 5 } },
  };
  return storageGet(subject, defaults[subject] || {});
}

function saveSubjectData(subject, data) {
  storageSet(subject, data);
}

// ---------------------- 奖励系统 ----------------------
function getRewards() {
  return storageGet('rewards', { list: [], exchanges: [] });
}

function saveRewards(rewards) {
  storageSet('rewards', rewards);
}

// ---------------------- 家长设置 ----------------------
function getSettings() {
  return storageGet('settings', {
    chineseDaily: 5,
    englishDaily: 5,
    mathDaily: 5,
    voiceEnabled: true,
    speechRate: 0.8,
  });
}

function saveSettings(settings) {
  storageSet('settings', settings);
}

// ---------------------- PIN ----------------------
function getPin() {
  return storageGet('parentPin', '1234');
}

function setPin(newPin) {
  storageSet('parentPin', newPin);
}

// ---------------------- 通用工具 ----------------------
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOptions(correct, pool, count = 4) {
  const wrong = shuffle(pool.filter(item => item !== correct)).slice(0, count - 1);
  return shuffle([correct, ...wrong]);
}

// ---------------------- 语音 ----------------------
function speakText(text, lang = 'zh-CN', rate = 0.85) {
  if (!window.speechSynthesis) return;
  const settings = getSettings();
  if (settings.voiceEnabled === false) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = settings.speechRate || rate;
  window.speechSynthesis.speak(u);
}

function speakEnglish(text, rate = 0.75) {
  speakText(text, 'en-US', rate);
}

// ---------------------- 通用弹窗 ----------------------
function showModal(title, content, buttons = []) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const btns = buttons.length
    ? `<div class="modal-buttons">${buttons.map(b =>
        `<button class="${b.className || 'btn-modal-ok'}" ${b.onclick ? `onclick="${b.onclick}"` : ''}>${b.text}</button>`
      ).join('')}</div>`
    : `<div class="modal-buttons"><button class="btn-modal-ok" onclick="closeModal()">知道了</button></div>`;

  box.innerHTML = `<h3>${title}</h3><div class="modal-content">${content}</div>${btns}`;
  overlay.classList.add('show');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('show');
}

// ---------------------- UI 更新 ----------------------
function updatePointsUI() {
  document.querySelectorAll('[data-points]').forEach(el => {
    el.textContent = getProfile().points;
  });
}

function updateStreakUI() {
  document.querySelectorAll('[data-streak]').forEach(el => {
    el.textContent = getProfile().streak;
  });
}

function initCommonUI() {
  updatePointsUI();
  updateStreakUI();
}

// ---------------------- 导出/导入/清空 ----------------------
function exportAllData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      data[key] = localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `宝宝学习台备份_${formatDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith(PREFIX)) {
      localStorage.setItem(key, value);
    }
  });
}

function clearAllData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}

// 页面加载时自动迁移旧数据
migrateLegacyData();

// ============================================================
// 识字模块专用兼容存储层
// 为保持 宝宝识字台.html 原有代码尽量不变，提供与原 K/load/save 兼容的 API
// 底层统一走 BabyLearning_chinese / profile / rewards / settings
// ============================================================
const ChineseStore = {
  prefix: 'wb_babychar_',

  today() { return formatDate(new Date()); },
  yesterday() { return formatDate(new Date(Date.now() - 86400000)); },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  getChinese() {
    return getSubjectData('chinese');
  },
  setChinese(data) {
    saveSubjectData('chinese', data);
  },

  load(key, def) {
    const ch = this.getChinese();
    if (ch[key] !== undefined) return ch[key];
    return def;
  },
  save(key, val) {
    const ch = this.getChinese();
    ch[key] = val;
    this.setChinese(ch);
  },

  // 阶段 cursor 单独存为 charCursor_sN
  getStageCursor(stage) {
    return this.load('charCursor_s' + stage, 0);
  },
  setStageCursor(stage, v) {
    this.save('charCursor_s' + stage, v);
  },

  get daily() { return 'dailyCount'; },
  get pin() { return 'pin'; },
  get progress() { return 'progress'; },
  get dailyLog() { return 'dailyLog'; },
  get points() { return 'points'; },
  get pointsHistory() { return 'pointsHistory'; },
  get rewards() { return 'rewards'; },
  get exchanges() { return 'exchanges'; },
  get streak() { return 'streak'; },
  get charCursor() { return 'charCursor'; },
  get mode() { return 'mode'; },
  get stage() { return 'stage'; },
  get voice() { return 'voice'; },
  get rate() { return 'rate'; },
  get voiceUri() { return 'voiceUri'; },

  getDailyCount() { return this.load(this.daily, 5); },
  getCharCursor() { return this.load(this.charCursor, 0); },
  getDailyLog() { return this.load(this.dailyLog, {}); },
  getPointsHistory() { return this.load(this.pointsHistory, []); },
  getStage() { return this.load(this.stage, 1); },

  // 通用 profile/rewards/exchanges/streak/pin/settings 走 utils 公共函数
  getPoints() { return getProfile().points; },
  addPoints(amount, desc) {
    addPoints(amount, desc);
    const hist = this.getPointsHistory();
    hist.push({ type: amount > 0 ? 'earn' : 'spend', amount: Math.abs(amount), date: this.today(), desc });
    this.save(this.pointsHistory, hist);
  },
  getRewards() { return getRewards().list; },
  saveRewards(list) {
    const rewards = getRewards();
    rewards.list = list;
    saveRewards(rewards);
  },
  getExchanges() { return getRewards().exchanges; },
  saveExchanges(list) {
    const rewards = getRewards();
    rewards.exchanges = list;
    saveRewards(rewards);
  },
  getStreak() {
    const profile = getProfile();
    return { count: profile.streak || 0, lastDate: profile.lastLearnDate || '' };
  },
  saveStreak(streak) {
    const profile = getProfile();
    profile.streak = streak.count;
    profile.lastLearnDate = streak.lastDate;
    saveProfile(profile);
  },
  getPin() { return getPin(); },
  savePin(pin) { setPin(pin); },

  // 设置：语速/发音人等继续存在 chinese 中，但 voice 开关走全局 settings
  getVoiceEnabled() {
    const settings = getSettings();
    return settings.voiceEnabled !== false;
  },
  saveVoiceEnabled(v) {
    const settings = getSettings();
    settings.voiceEnabled = v;
    saveSettings(settings);
  },
  getRate() {
    const settings = getSettings();
    return settings.speechRate;
  },
  saveRate(v) {
    const settings = getSettings();
    settings.speechRate = v;
    saveSettings(settings);
  },

  // 导出时收集所有识字相关 key
  exportKeys() {
    const ch = this.getChinese();
    return Object.keys(ch).reduce((acc, k) => {
      acc[this.prefix + k] = ch[k];
      return acc;
    }, {});
  },
};
