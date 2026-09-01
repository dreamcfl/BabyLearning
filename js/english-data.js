// ============================================================
// 宝宝英语台 - 词库与游戏数据
// ============================================================

const ENGLISH_CATEGORIES = [
  { id: 'animals', name: '小动物', icon: '🐾' },
  { id: 'fruits', name: '水果', icon: '🍎' },
  { id: 'colors', name: '颜色', icon: '🌈' },
  { id: 'family', name: '家人', icon: '👨‍👩‍👧' },
  { id: 'body', name: '身体', icon: '✋' },
  { id: 'food', name: '食物', icon: '🍚' },
];

const ENGLISH_WORDS = [
  { en: 'cat', cn: '猫', category: 'animals', emoji: '🐱', sentence: 'The cat is cute.' },
  { en: 'dog', cn: '狗', category: 'animals', emoji: '🐶', sentence: 'I have a dog.' },
  { en: 'bird', cn: '鸟', category: 'animals', emoji: '🐦', sentence: 'A bird can fly.' },
  { en: 'fish', cn: '鱼', category: 'animals', emoji: '🐟', sentence: 'The fish swims.' },
  { en: 'rabbit', cn: '兔子', category: 'animals', emoji: '🐰', sentence: 'The rabbit jumps.' },
  { en: 'duck', cn: '鸭子', category: 'animals', emoji: '🦆', sentence: 'Quack, quack, duck!' },

  { en: 'apple', cn: '苹果', category: 'fruits', emoji: '🍎', sentence: 'I eat an apple.' },
  { en: 'banana', cn: '香蕉', category: 'fruits', emoji: '🍌', sentence: 'A yellow banana.' },
  { en: 'grape', cn: '葡萄', category: 'fruits', emoji: '🍇', sentence: 'Grapes are purple.' },
  { en: 'orange', cn: '橙子', category: 'fruits', emoji: '🍊', sentence: 'An orange orange.' },
  { en: 'watermelon', cn: '西瓜', category: 'fruits', emoji: '🍉', sentence: 'Watermelon is sweet.' },
  { en: 'strawberry', cn: '草莓', category: 'fruits', emoji: '🍓', sentence: 'A red strawberry.' },

  { en: 'red', cn: '红色', category: 'colors', emoji: '🔴', sentence: 'The apple is red.' },
  { en: 'blue', cn: '蓝色', category: 'colors', emoji: '🔵', sentence: 'The sky is blue.' },
  { en: 'green', cn: '绿色', category: 'colors', emoji: '🟢', sentence: 'Grass is green.' },
  { en: 'yellow', cn: '黄色', category: 'colors', emoji: '🟡', sentence: 'A yellow duck.' },
  { en: 'purple', cn: '紫色', category: 'colors', emoji: '🟣', sentence: 'Grapes are purple.' },
  { en: 'black', cn: '黑色', category: 'colors', emoji: '⚫', sentence: 'A black cat.' },

  { en: 'mom', cn: '妈妈', category: 'family', emoji: '👩', sentence: 'I love my mom.' },
  { en: 'dad', cn: '爸爸', category: 'family', emoji: '👨', sentence: 'I love my dad.' },
  { en: 'baby', cn: '宝宝', category: 'family', emoji: '👶', sentence: 'The baby smiles.' },
  { en: 'brother', cn: '哥哥', category: 'family', emoji: '👦', sentence: 'My brother plays.' },
  { en: 'sister', cn: '姐姐', category: 'family', emoji: '👧', sentence: 'My sister sings.' },
  { en: 'grandma', cn: '奶奶', category: 'family', emoji: '👵', sentence: 'Grandma is kind.' },

  { en: 'eye', cn: '眼睛', category: 'body', emoji: '👁️', sentence: 'I see with my eye.' },
  { en: 'hand', cn: '手', category: 'body', emoji: '✋', sentence: 'I wave my hand.' },
  { en: 'foot', cn: '脚', category: 'body', emoji: '🦶', sentence: 'I stomp my foot.' },
  { en: 'ear', cn: '耳朵', category: 'body', emoji: '👂', sentence: 'I hear with my ear.' },
  { en: 'nose', cn: '鼻子', category: 'body', emoji: '👃', sentence: 'My nose is small.' },
  { en: 'mouth', cn: '嘴巴', category: 'body', emoji: '👄', sentence: 'Open your mouth.' },

  { en: 'rice', cn: '米饭', category: 'food', emoji: '🍚', sentence: 'I like rice.' },
  { en: 'noodles', cn: '面条', category: 'food', emoji: '🍜', sentence: 'Yummy noodles.' },
  { en: 'egg', cn: '鸡蛋', category: 'food', emoji: '🥚', sentence: 'An egg is oval.' },
  { en: 'milk', cn: '牛奶', category: 'food', emoji: '🥛', sentence: 'Drink your milk.' },
  { en: 'bread', cn: '面包', category: 'food', emoji: '🍞', sentence: 'Bread is soft.' },
  { en: 'cake', cn: '蛋糕', category: 'food', emoji: '🍰', sentence: 'Birthday cake!' },
];

const ENGLISH_GAMES = [
  { key: 'cards', icon: '🃏', name: '单词卡', scored: false },
  { key: 'listen', icon: '🔊', name: '听音选图', scored: true },
  { key: 'spell', icon: '🔠', name: '字母拼图', scored: true },
  { key: 'match', icon: '🧩', name: '找朋友', scored: true },
];

const ENGLISH_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
