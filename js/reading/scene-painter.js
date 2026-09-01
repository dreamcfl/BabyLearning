// ============================================================
// 阅读角 - Canvas 场景插画引擎
// 根据每页的 emoji 自动推断场景主题，程序化绘制绘本插画：
// 渐变天空 + 远景装饰 + 地面 + emoji 角色（浮动）+ 粒子特效
// 纯 Canvas 2D，零外部依赖，支持 file:// 离线打开
// ============================================================

// ---------------------- 场景主题 ----------------------
// sky: 天空渐变色（上→下）；ground: 地面色；decor: 远景；particles: 特效
const SCENE_THEMES = {
  day:    { sky: ['#8FD3F4', '#DFF6FF'], ground: '#8BC34A', decor: ['sun', 'clouds'], particles: null },
  sunset: { sky: ['#FFB75E', '#FF6B6B', '#5B2C6F'], ground: '#6D4C41', decor: ['sun-low', 'hills'], particles: null },
  night:  { sky: ['#2C3E8F', '#4A148C'], ground: '#2E4A2F', decor: ['moon', 'stars'], particles: 'sparkles' },
  forest: { sky: ['#C8E6C9', '#DCEDC8'], ground: '#558B2F', decor: ['trees', 'clouds'], particles: null },
  water:  { sky: ['#4FC3F7', '#B3E5FC'], ground: '#0288D1', decor: ['sun', 'waves'], particles: null },
  snow:   { sky: ['#90A4AE', '#ECEFF1'], ground: '#FAFAFA', decor: ['clouds'], particles: 'snow' },
  garden: { sky: ['#F8BBD0', '#FCE4EC'], ground: '#81C784', decor: ['flowers', 'clouds'], particles: 'petals' },
  room:   { sky: ['#FFF3E0', '#FFE0B2'], ground: '#D7CCC8', decor: ['window'], particles: null },
};

// ---------------------- emoji → 主题 ----------------------
// 主题优先级：命中数相同时，特征越明显（值越大）的主题优先
const THEME_PRIORITY = { snow: 3, night: 3, sunset: 2, water: 2, forest: 2, garden: 1, room: 1, day: 0 };

const EMOJI_THEME = {
  water:  ['🌊','💧','🐟','🐠','🐸','🦆','🐢','⛵','🚣','🫧','🐋','🐬','🦈','🪣','🛶','🏊','🐙','🦐','💦','🌧️'],
  night:  ['🌙','⭐','🌟','✨','🌛','🌜','💫','🦉','🌃','🛏️','😴','💤','🕯️','🔦','👻','🎃'],
  snow:   ['❄️','⛄','🧊','🌨️','🥶','🎿','⛷️','🛷'],
  forest: ['🌳','🌲','🌿','🍃','🐻','🐰','🦊','🐺','🐗','🦌','🐿️','🌰','🍂','🐒','🐯','🦁','🐘','🌴','🪵','🏕️','🐼','🦔','🐛'],
  garden: ['🌸','🌷','🌹','🌺','🌻','🌼','🦋','🐝','🌱','🍀','🌾','🥕','🍓','🌽','🪴','💐','🍎','🍇','🍉','🍊','🍌','🍑','🍒','🥚'],
  room:   ['🏠','🛏️','🪑','🚪','🪟','🍚','🍰','🥣','🧸','📚','🖼️','☕','🫖','🍽️','🧦','🪞','🏡','⛩️','🏯','🪡','🧺','🪓'],
  sunset: ['🌇','🌅','🏔️','⛰️','🌄','🔥','🎆','🌉'],
  day:    [],
};

const ScenePainter = {
  _raf: null,
  _resize: null,

  // 拆分 emoji（优先 Intl.Segmenter，正确处理 ZWJ 组合 emoji）
  splitEmojis(str) {
    if (!str) return [];
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
        return Array.from(seg.segment(String(str)), s => s.segment).filter(s => s.trim());
      }
    } catch (e) { /* 降级 */ }
    return Array.from(String(str)).filter(s => s.trim());
  },

  // 命中数最多的主题；命中数相同时取特征更明显的（优先级更高）
  detectTheme(emojis) {
    let best = 'day';
    let max = 0;
    let maxPriority = -1;
    Object.keys(EMOJI_THEME).forEach(theme => {
      const hit = EMOJI_THEME[theme].reduce((n, e) => n + (emojis.includes(e) ? 1 : 0), 0);
      const priority = THEME_PRIORITY[theme] || 0;
      if (hit > max || (hit === max && hit > 0 && priority > maxPriority)) {
        max = hit;
        maxPriority = priority;
        best = theme;
      }
    });
    return best;
  },

  // 挂载到容器并启动动画
  mount(container, sceneStr, bgColor) {
    if (!container) return;
    this.stop();

    const emojis = this.splitEmojis(sceneStr || '📖');
    const themeKey = this.detectTheme(emojis);
    const theme = SCENE_THEMES[themeKey] || SCENE_THEMES.day;

    try {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
    } catch (e) {
      // 不支持 canvas 时降级为纯 emoji
      container.innerHTML = `<div class="reader-scene">${sceneStr || '📖'}</div>`;
      return;
    }

    canvas.className = 'reader-canvas';
    container.innerHTML = '';
    container.appendChild(canvas);

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width, 240);
      const h = Math.max(rect.height, 160);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    this._resize = resize;

    const start = performance.now();
    const loop = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width, 240);
      const h = Math.max(rect.height, 160);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      this._draw(ctx, w, h, emojis, theme, bgColor, performance.now() - start);
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  },

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._resize) {
      window.removeEventListener('resize', this._resize);
      this._resize = null;
    }
  },

  // ---------------------- 绘制主流程 ----------------------
  _draw(ctx, w, h, emojis, theme, bgColor, t) {
    // 1. 天空
    const colors = bgColor ? [bgColor, this._lighten(bgColor, 0.4)] : theme.sky;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    colors.forEach((c, i) => g.addColorStop(colors.length > 1 ? i / (colors.length - 1) : 0, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 2. 远景装饰
    theme.decor.forEach(d => this._drawDecor(ctx, w, h, d, t));

    // 3. 地面
    if (theme.ground) {
      const gy = h * 0.74;
      ctx.fillStyle = theme.ground;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, gy + Math.sin(x / 45 + t / 2600) * 5);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    }

    // 4. 角色
    this._drawActors(ctx, w, h, emojis, t);

    // 5. 粒子
    if (theme.particles) this._drawParticles(ctx, w, h, theme.particles, t);
  },

  // ---------------------- 远景装饰 ----------------------
  _drawDecor(ctx, w, h, type, t) {
    if (type === 'sun' || type === 'sun-low') {
      const low = type === 'sun-low';
      const x = w * (low ? 0.7 : 0.84);
      const y = h * (low ? 0.5 : 0.2);
      const c1 = low ? 'rgba(255,138,101,0.85)' : 'rgba(255,241,118,0.9)';
      const c2 = low ? '#FF7043' : '#FFE082';
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 46);
      glow.addColorStop(0, c1);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2); ctx.fill();
      return;
    }

    if (type === 'clouds') {
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      const drift = (t / 90) % (w + 180);
      [[0.2, 0.16, 1], [0.62, 0.1, 0.75], [0.86, 0.28, 0.6]].forEach(([fx, fy, s], i) => {
        const cx = ((fx * w + drift + i * 90) % (w + 180)) - 90;
        const cy = h * fy;
        [0, 15 * s, 30 * s].forEach((dx, k) => {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + (k === 1 ? -8 * s : 0), (k === 1 ? 17 : 12) * s, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      return;
    }

    if (type === 'moon') {
      const x = w * 0.8, y = h * 0.18;
      const glow = ctx.createRadialGradient(x, y, 3, x, y, 38);
      glow.addColorStop(0, 'rgba(255,255,255,0.55)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(x + 13, y - 4, 13, 0, Math.PI * 2); ctx.fill();
      return;
    }

    if (type === 'stars') {
      for (let i = 0; i < 22; i++) {
        const x = ((i * 137) % 100) / 100 * w;
        const y = ((i * 61) % 100) / 100 * h * 0.62;
        const tw = 0.35 + Math.abs(Math.sin(t / 700 + i)) * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }

    if (type === 'trees') {
      [[0.12, 0.66, 1], [0.88, 0.62, 0.85], [0.3, 0.7, 0.6]].forEach(([fx, fy, s]) => {
        const x = w * fx, y = h * fy;
        ctx.fillStyle = '#795548';
        ctx.fillRect(x - 4 * s, y, 8 * s, 26 * s);
        ctx.fillStyle = '#43A047';
        ctx.beginPath(); ctx.arc(x, y - 12 * s, 20 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath(); ctx.arc(x - 8 * s, y - 4 * s, 13 * s, 0, Math.PI * 2); ctx.fill();
      });
      return;
    }

    if (type === 'flowers') {
      const gy = h * 0.74;
      for (let i = 0; i < 9; i++) {
        const x = ((i * 97) % 100) / 100 * w + 10;
        const y = gy + 12 + ((i * 37) % 26);
        ctx.strokeStyle = '#388E3C';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.stroke();
        ctx.fillStyle = ['#F48FB1', '#FFD54F', '#BA68C8', '#FFF176'][i % 4];
        ctx.beginPath(); ctx.arc(x, y - 15, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FDD835';
        ctx.beginPath(); ctx.arc(x, y - 15, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }

    if (type === 'hills') {
      const gy = h * 0.74;
      ctx.fillStyle = 'rgba(93,64,55,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w * 0.28, gy - h * 0.3);
      ctx.lineTo(w * 0.52, gy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(109,76,65,0.45)';
      ctx.beginPath();
      ctx.moveTo(w * 0.42, gy);
      ctx.lineTo(w * 0.74, gy - h * 0.22);
      ctx.lineTo(w, gy);
      ctx.closePath(); ctx.fill();
      return;
    }

    if (type === 'window') {
      const x = w * 0.78, y = h * 0.16, s = Math.min(w, h) * 0.2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x, y, s, s * 1.15);
      ctx.fillStyle = '#B3E5FC';
      ctx.fillRect(x + 3, y + 3, s - 6, s * 1.15 - 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s * 1.15);
      ctx.moveTo(x, y + s * 0.57); ctx.lineTo(x + s, y + s * 0.57);
      ctx.stroke();
      return;
    }
  },

  // ---------------------- emoji 角色 ----------------------
  _drawActors(ctx, w, h, emojis, t) {
    const list = emojis.length ? emojis : ['📖'];
    const n = list.length;
    const size = n === 1 ? 86 : n === 2 ? 70 : n === 3 ? 58 : 48;
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const gap = size * 1.18;
    const startX = w / 2 - ((n - 1) * gap) / 2;
    const baseY = h * 0.58;

    list.forEach((e, i) => {
      // 轻微上下浮动 + 左右错落，避免呆板
      const bob = Math.sin(t / 780 + i * 1.25) * 6;
      const x = startX + i * gap;
      const y = baseY + bob + (i % 2 ? 4 : 0);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 7;
      ctx.fillText(e, x, y);
      ctx.restore();
    });
  },

  // ---------------------- 粒子特效 ----------------------
  _drawParticles(ctx, w, h, type, t) {
    const COUNT = 16;
    for (let i = 0; i < COUNT; i++) {
      const seed = ((i * 9301 + 49297) % 233280) / 233280;
      const speed = 0.012 + seed * 0.022;
      const fall = (seed * h + t * speed * 60) % (h + 60) - 30;
      const x = (seed * 7919 % 1) * w + Math.sin(t / 900 + i) * 12;
      const r = 2 + seed * 3;
      const a = 0.35 + seed * 0.4;

      if (type === 'snow') {
        ctx.fillStyle = `rgba(255,255,255,${a + 0.25})`;
        ctx.beginPath(); ctx.arc(x, fall, r, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'petals') {
        ctx.fillStyle = `rgba(244,143,177,${a})`;
        ctx.save();
        ctx.translate(x, fall);
        ctx.rotate(t / 700 + i);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.7, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (type === 'bubbles') {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(x, h - fall, r * 1.5, 0, Math.PI * 2); ctx.stroke();
      } else if (type === 'sparkles') {
        const tw = 0.3 + Math.abs(Math.sin(t / 520 + i)) * 0.65;
        ctx.fillStyle = `rgba(255,241,118,${tw})`;
        ctx.beginPath(); ctx.arc(x, seed * h * 0.72, r * 0.75, 0, Math.PI * 2); ctx.fill();
      }
    }
  },

  // 颜色变浅（用于生成天空渐变底色）
  _lighten(hex, amount) {
    const m = String(hex).replace('#', '');
    if (m.length !== 6) return hex;
    const mix = c => Math.round(c + (255 - c) * amount);
    return `rgb(${mix(parseInt(m.slice(0, 2), 16))},${mix(parseInt(m.slice(2, 4), 16))},${mix(parseInt(m.slice(4, 6), 16))})`;
  },
};
