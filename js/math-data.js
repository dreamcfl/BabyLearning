// ============================================================
// 宝宝数学台 - 游戏数据与题目生成
// ============================================================

const MATH_SHAPES = [
  { name: '圆形', emoji: '🔵', color: '#4A90E2' },
  { name: '正方形', emoji: '🟦', color: '#6BCB77' },
  { name: '三角形', emoji: '🔺', color: '#FF8C42' },
  { name: '星形', emoji: '⭐', color: '#FFD93D' },
  { name: '心形', emoji: '❤️', color: '#FF6B6B' },
];

const MATH_ITEMS = [
  { emoji: '🍎', name: '苹果' },
  { emoji: '🍌', name: '香蕉' },
  { emoji: '🍊', name: '橙子' },
  { emoji: '🍇', name: '葡萄' },
  { emoji: '🍓', name: '草莓' },
  { emoji: '🐤', name: '小鸡' },
  { emoji: '🐟', name: '小鱼' },
  { emoji: '🌸', name: '小花' },
];

function makeAddSub(max = 10) {
  const type = Math.random() > 0.4 ? 'add' : 'sub';
  if (type === 'add') {
    const a = 1 + Math.floor(Math.random() * (max - 1));
    const b = 1 + Math.floor(Math.random() * (max - a));
    return { q: `${a} + ${b}`, a: a + b, type };
  }
  const a = 1 + Math.floor(Math.random() * max);
  const b = Math.floor(Math.random() * (a - 1)) + 1;
  return { q: `${a} - ${b}`, a: a - b, type };
}

function makeCompare(max = 10) {
  const a = Math.floor(Math.random() * max) + 1;
  let b = Math.floor(Math.random() * max) + 1;
  while (b === a) b = Math.floor(Math.random() * max) + 1;
  return { a, b };
}

function makeCount(max = 9) {
  const count = Math.floor(Math.random() * max) + 1;
  const item = MATH_ITEMS[Math.floor(Math.random() * MATH_ITEMS.length)];
  return { count, item };
}

function makePattern() {
  const shapes = MATH_SHAPES.slice(0, 3);
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push(shapes[i % shapes.length]);
  const answer = shapes[4 % shapes.length];
  return { seq, answer };
}
