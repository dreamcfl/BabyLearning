// ============================================================
// 阅读角 - 诗词 / 童谣阅读视图
// 依赖：reader.js（ReadingPlayer、speakReading）
// ============================================================

// 诗词详情：展示原文、拼音、译文、小知识，支持朗读全诗与逐句跟读
function renderPoemDetail(id) {
  const poem = getReadingBook('poem', id);
  if (!poem) return;

  const container = document.getElementById('readingContent');
  container.innerHTML = `
    <div class="reader-head">
      <button class="btn-back" onclick="backToShelf()">← 诗单</button>
      <div class="reader-title">${poem.title}</div>
    </div>

    <div class="poem-card">
      <div class="poem-emoji">${poem.emoji}</div>
      <h2 class="poem-name">${poem.title}</h2>
      <div class="poem-author">${poem.dynasty} · ${poem.author}</div>

      <div class="poem-lines">
        ${poem.lines.map((line, i) => `
          <div class="poem-line" id="poemLine${i}" onclick="speakPoemLine(${i})">
            <div class="poem-line-main">
              <div class="poem-pinyin">${line.pinyin}</div>
              <div class="poem-text">${line.text}</div>
            </div>
            <div class="poem-play">🔊</div>
          </div>
        `).join('')}
      </div>

      <div class="poem-actions">
        <button class="reader-btn primary" onclick="speakWholePoem()">🔊 朗读全诗</button>
        <button class="reader-btn" id="poemAutoBtn" onclick="togglePoemAuto()">▶ 逐句跟读</button>
      </div>

      <div class="poem-section">
        <div class="poem-section-title">📖 诗意</div>
        <p>${poem.translation}</p>
      </div>

      <div class="poem-section">
        <div class="poem-section-title">💡 小知识</div>
        <p>${poem.note}</p>
      </div>
    </div>
  `;

  ReadingPlayer.open(poem.lines, {
    lang: 'zh-CN',
    getText: item => item.text,
    onUpdate: updatePoemHighlight,
  });
}

function updatePoemHighlight(index) {
  document.querySelectorAll('.poem-line').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  const btn = document.getElementById('poemAutoBtn');
  if (btn) btn.innerHTML = ReadingPlayer.auto ? '⏸ 停止跟读' : '▶ 逐句跟读';
}

function speakPoemLine(index) {
  ReadingPlayer.goTo(index);
}

function speakWholePoem() {
  const poem = getReadingBook('poem', currentReadingBookId());
  if (!poem) return;
  ReadingPlayer.stopAuto();
  const text = `${poem.title}，${poem.author}。${poem.lines.map(l => l.text).join('')}`;
  speakReading(text, 'zh-CN');
}

function togglePoemAuto() {
  ReadingPlayer.toggleAuto();
}
