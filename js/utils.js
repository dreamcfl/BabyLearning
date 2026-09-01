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
  const settings = getSettings();
  if (settings.voiceEnabled === false) return;

  // 统一走 Speech 引擎（处理安卓/华为的解锁、语音列表、静默失败等问题）
  if (typeof Speech !== 'undefined' && Speech.supported) {
    Speech.speak(text, {
      lang,
      rate: settings.speechRate || rate,
      onfail: reason => Speech.showHelp(reason),
    });
    return;
  }

  if (!window.speechSynthesis) return;
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

// ---------------------- 学习时长统计 ----------------------
const STUDY_TIME_KEY = 'studyTime';
const REMINDER_INTERVAL_MINUTES = 60;
const FIRST_REMINDER_MINUTES = 30;
const STUDY_TICK_MS = 1000;

function getStudyTime() {
  return storageGet(STUDY_TIME_KEY, {
    daily: {}, // { '2026-09-01': 秒数 }
    todayDate: formatDate(new Date()),
    currentSession: 0,
    lastTick: Date.now(),
    remindedMinutes: [],
  });
}

function saveStudyTime(data) {
  storageSet(STUDY_TIME_KEY, data);
}

function getTodayStudySeconds() {
  const data = getStudyTime();
  const today = formatDate(new Date());
  const history = data.daily && data.daily[today] ? data.daily[today] : 0;
  return history + data.currentSession;
}

function formatStudyDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
  return parts.join('');
}

function updateStudyTimeDisplay() {
  const seconds = getTodayStudySeconds();
  const text = formatStudyDuration(seconds);
  document.querySelectorAll('[data-study-time]').forEach(el => {
    el.textContent = text;
  });
}

function recordStudyTick() {
  const now = Date.now();
  const data = getStudyTime();
  const today = formatDate(new Date());

  // 跨天重置
  if (data.todayDate !== today) {
    data.todayDate = today;
    data.currentSession = 0;
    data.remindedMinutes = [];
  }

  // 防止标签页休眠后一次性跳太多：单次最多记 5 秒
  const elapsed = data.lastTick ? Math.min(5, Math.round((now - data.lastTick) / 1000)) : 1;
  data.currentSession += Math.max(0, elapsed);
  data.lastTick = now;
  saveStudyTime(data);

  updateStudyTimeDisplay();
  checkRestReminder();
}

function checkRestReminder() {
  const totalMinutes = Math.floor(getTodayStudySeconds() / 60);
  const data = getStudyTime();
  const reminded = new Set(data.remindedMinutes || []);

  let shouldRemind = false;
  if (totalMinutes >= FIRST_REMINDER_MINUTES && !reminded.has(FIRST_REMINDER_MINUTES)) {
    shouldRemind = true;
    reminded.add(FIRST_REMINDER_MINUTES);
  }

  // 1 小时及以后每隔 1 小时提醒
  if (totalMinutes >= 60) {
    const reminderPoint = Math.floor(totalMinutes / REMINDER_INTERVAL_MINUTES) * REMINDER_INTERVAL_MINUTES;
    if (reminderPoint >= REMINDER_INTERVAL_MINUTES && !reminded.has(reminderPoint)) {
      shouldRemind = true;
      reminded.add(reminderPoint);
    }
  }

  if (shouldRemind) {
    data.remindedMinutes = Array.from(reminded);
    saveStudyTime(data);
    showRestReminder(totalMinutes);
  }
}

function showRestReminder(totalMinutes) {
  let overlay = document.getElementById('restReminderOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'restReminderOverlay';
    overlay.className = 'rest-reminder-overlay';
    overlay.innerHTML = `
      <div class="rest-reminder-box">
        <div class="rest-reminder-icon">🌿</div>
        <h3>该休息一会儿啦</h3>
        <p class="rest-reminder-text"></p>
        <button class="rest-reminder-btn" onclick="closeRestReminder()">我知道了</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const text = overlay.querySelector('.rest-reminder-text');
  text.textContent = `今天已经学习了 ${formatStudyDuration(totalMinutes * 60)}，让眼睛和身体都休息一下吧～`;
  overlay.classList.add('show');
}

function closeRestReminder() {
  const overlay = document.getElementById('restReminderOverlay');
  if (overlay) overlay.classList.remove('show');
}

let _studyTimerStarted = false;
function startStudyTimer() {
  if (_studyTimerStarted) return;
  _studyTimerStarted = true;
  // 立即执行一次，确保打开页面就能看到时长
  recordStudyTick();
  setInterval(recordStudyTick, STUDY_TICK_MS);
}

function getStudyTimeSummary(days = 7) {
  const data = getStudyTime();
  const result = [];
  // 倒序返回：最新日期在最前，方便家长端直接展示
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = formatDate(d);
    const seconds = data.daily && data.daily[date] ? data.daily[date] : 0;
    result.push({ date, seconds, current: date === formatDate(new Date()) });
  }
  return result;
}

function stopAndPersistSession() {
  const data = getStudyTime();
  const today = formatDate(new Date());
  if (data.currentSession > 0) {
    data.daily = data.daily || {};
    data.daily[today] = (data.daily[today] || 0) + data.currentSession;
    data.currentSession = 0;
    data.lastTick = Date.now();
    saveStudyTime(data);
  }
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
  updateStudyTimeDisplay();
  injectStudyTimeStyles();
  startStudyTimer();
}

function injectStudyTimeStyles() {
  if (document.getElementById('studyTimeStyles')) return;
  const style = document.createElement('style');
  style.id = 'studyTimeStyles';
  style.textContent = `
    .study-time-pill {
      background: rgba(255,255,255,0.2);
      color: #fff;
      padding: 6px 12px;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .study-time-floating {
      position: fixed;
      bottom: calc(16px + env(safe-area-inset-bottom));
      right: 16px;
      background: rgba(0,0,0,0.65);
      color: #fff;
      padding: 8px 14px;
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 700;
      z-index: 300;
      backdrop-filter: blur(4px);
    }
    .rest-reminder-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 500;
      padding: 20px;
    }
    .rest-reminder-overlay.show { display: flex; }
    .rest-reminder-box {
      background: #fff;
      border-radius: 24px;
      padding: 28px 24px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      animation: restReminderIn 0.3s ease;
    }
    .rest-reminder-icon { font-size: 3rem; margin-bottom: 8px; }
    .rest-reminder-box h3 { font-size: 1.3rem; color: #4A4A4A; margin-bottom: 8px; }
    .rest-reminder-text { color: #888; font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px; }
    .rest-reminder-btn {
      background: linear-gradient(135deg, #6BCB77 0%, #4ECDC4 100%);
      color: #fff;
      border: none;
      padding: 12px 28px;
      border-radius: 50px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      min-height: 48px;
    }
    @keyframes restReminderIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function injectStudyTimeIndicator() {
  const actions = document.querySelector('.topbar-actions');
  if (actions && !actions.querySelector('[data-study-time]')) {
    const pill = document.createElement('span');
    pill.className = 'study-time-pill';
    pill.innerHTML = '⏱️ <span data-study-time>0秒</span>';
    actions.appendChild(pill);
    updateStudyTimeDisplay();
  }
}

// 页面加载完成后统一初始化
document.addEventListener('DOMContentLoaded', () => {
  injectStudyTimeIndicator();
  initCommonUI();
});

// 页面隐藏/关闭时把当前会话固化到当日累计
window.addEventListener('beforeunload', stopAndPersistSession);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAndPersistSession();
  } else {
    const data = getStudyTime();
    data.lastTick = Date.now();
    saveStudyTime(data);
  }
});

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
  getDailyLog() {
    const raw = this.load(this.dailyLog, {});
    const log = {};
    Object.keys(raw).forEach(k => {
      log[k] = Array.isArray(raw[k]) ? raw[k] : [];
    });
    return log;
  },
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
