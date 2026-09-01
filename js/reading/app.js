// ============================================================
// 阅读角 - 入口：模式切换 / 书架 / 绘本与故事阅读器
// 依赖：reader.js、poem-view.js、四个数据文件
// ============================================================

const READING_MODES = [
  { key: 'picture', icon: '📚', name: '绘本', hint: '点开一本绘本，一边看图一边听故事' },
  { key: 'story', icon: '🧸', name: '故事', hint: '每个故事的结尾，都藏着一个小道理' },
  { key: 'poem', icon: '🎋', name: '诗词', hint: '跟着拼音读古诗，感受韵律的美' },
  { key: 'english', icon: '🌍', name: '英语', hint: '先听英文，再看中文，磨磨小耳朵' },
];

let readingMode = 'picture';
let _currentBookId = null;

function currentReadingBookId() {
  return _currentBookId;
}

function getModeList(mode) {
  if (mode === 'picture') return PICTURE_BOOKS;
  if (mode === 'story') return STORIES;
  if (mode === 'poem') return POEMS.concat(NURSERY_RHYMES);
  if (mode === 'english') return ENGLISH_BOOKS;
  return [];
}

function getReadingBook(mode, id) {
  return getModeList(mode).find(b => b.id === id);
}

// 把不同结构的数据统一成书架卡片需要的字段
function normalizeBookCard(mode, book) {
  if (mode === 'english') {
    return { id: book.id, title: book.title, sub: book.titleCn, cover: book.cover, desc: book.desc, tag: book.level };
  }
  if (mode === 'poem') {
    return {
      id: book.id,
      title: book.title,
      sub: `${book.dynasty} · ${book.author}`,
      cover: book.emoji,
      desc: book.lines[0].text,
      tag: book.dynasty === '童谣' ? '童谣' : '古诗',
    };
  }
  return { id: book.id, title: book.title, sub: null, cover: book.cover, desc: book.desc, tag: book.age || null };
}

// ---------------------- 模式切换 ----------------------
function switchReadingMode(mode) {
  readingMode = mode;
  _currentBookId = null;
  stopReadingSpeech();
  ScenePainter.stop();

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  renderShelf();
}

// ---------------------- 书架 ----------------------
function renderShelf() {
  const mode = READING_MODES.find(m => m.key === readingMode);
  const list = getModeList(readingMode);
  const container = document.getElementById('readingContent');

  container.innerHTML = `
    <div class="shelf-tip">${mode.icon} ${mode.hint}</div>
    <div class="book-grid">
      ${list.map(book => {
        const card = normalizeBookCard(readingMode, book);
        return `
          <div class="book-card" onclick="openReadingBook('${card.id}')">
            <div class="book-cover">${card.cover}</div>
            <div class="book-title">${card.title}</div>
            ${card.sub ? `<div class="book-sub">${card.sub}</div>` : ''}
            <div class="book-desc">${card.desc}</div>
            ${card.tag ? `<span class="book-tag">${card.tag}</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function openReadingBook(id) {
  _currentBookId = id;
  if (readingMode === 'poem') {
    renderPoemDetail(id);
    return;
  }
  renderBookReader(id);
}

function backToShelf() {
  stopReadingSpeech();
  ReadingPlayer.stopAll();
  ScenePainter.stop();
  _currentBookId = null;
  renderShelf();
}

// ---------------------- 绘本 / 故事 / 英语绘本阅读器 ----------------------
function getBookPages(mode, book) {
  if (mode === 'picture') {
    return book.pages.map(p => ({ main: p.text, sub: null, scene: p.scene, bg: p.bg }));
  }
  if (mode === 'story') {
    return book.paragraphs.map(p => ({ main: p.text, sub: null, scene: p.emoji, bg: null }));
  }
  if (mode === 'english') {
    return book.pages.map(p => ({ main: p.en, sub: p.cn, scene: p.emoji, bg: null }));
  }
  return [];
}

function renderBookReader(id) {
  const book = getReadingBook(readingMode, id);
  if (!book) return;
  const pages = getBookPages(readingMode, book);
  const isEnglish = readingMode === 'english';
  const container = document.getElementById('readingContent');

  container.innerHTML = `
    <div class="reader-head">
      <button class="btn-back" onclick="backToShelf()">← 书架</button>
      <div class="reader-title">${book.title}${isEnglish && book.titleCn ? `（${book.titleCn}）` : ''}</div>
    </div>

    <div class="reader-stage" id="readerStage"></div>
    <div class="reader-text" id="readerText"></div>
    <div class="reader-progress" id="readerProgress"></div>

    <div class="reader-controls">
      <button class="reader-btn" onclick="readerPrev()">← 上一页</button>
      <button class="reader-btn primary" onclick="readerSpeak()">🔊 朗读</button>
      ${isEnglish ? '<button class="reader-btn" onclick="readerSpeakCn()">🇨🇳 中文</button>' : ''}
      <button class="reader-btn" id="readerAutoBtn" onclick="readerToggleAuto()">▶ 自动播放</button>
      <button class="reader-btn" onclick="readerNext()">下一页 →</button>
    </div>
  `;

  ReadingPlayer.open(pages, {
    lang: isEnglish ? 'en-US' : 'zh-CN',
    getText: item => item.main,
    onUpdate: updateReaderView,
  });
}

function updateReaderView(index, total) {
  const item = ReadingPlayer.current();
  if (!item) return;

  const stage = document.getElementById('readerStage');
  const text = document.getElementById('readerText');
  const progress = document.getElementById('readerProgress');
  const autoBtn = document.getElementById('readerAutoBtn');
  if (!stage || !text) return;

  stage.style.background = item.bg || 'linear-gradient(135deg, #FFFDF7 0%, #FFF3E0 100%)';
  // 用 Canvas 绘制场景插画（原为纯 emoji 文本）
  ScenePainter.mount(stage, item.scene || '📖', item.bg);
  text.innerHTML = `
    <div class="reader-main">${item.main}</div>
    ${item.sub ? `<div class="reader-sub">${item.sub}</div>` : ''}
  `;
  if (progress) progress.textContent = `${index + 1} / ${total}`;
  if (autoBtn) autoBtn.innerHTML = ReadingPlayer.auto ? '⏸ 停止播放' : '▶ 自动播放';
}

function readerPrev() {
  ReadingPlayer.prev();
}
function readerNext() {
  ReadingPlayer.next();
}
function readerSpeak() {
  ReadingPlayer.stopAuto();
  ReadingPlayer.speakCurrent();
}
function readerToggleAuto() {
  ReadingPlayer.toggleAuto();
}
function readerSpeakCn() {
  ReadingPlayer.speakCurrentAlt(item => item.sub);
}

// ---------------------- 初始化 ----------------------
function initReadingCorner() {
  switchReadingMode('picture');
}
