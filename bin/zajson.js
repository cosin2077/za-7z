#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('用法: node zajson.js <json文件路径>');
  process.exit(1);
}

const filePath = process.argv[2];

if (!fs.existsSync(filePath)) {
  console.error(`文件不存在: ${filePath}`);
  process.exit(1);
}

try {
  const raw = fs.readFileSync(filePath, 'utf8');
  // 解析并重新序列化为无空格/换行的 JSON
  const obj = JSON.parse(raw);
  const minified = JSON.stringify(obj);
  fs.writeFileSync(filePath, minified, 'utf8');
  console.log(`已压缩并覆盖保存: ${filePath}`);
} catch (err) {
  console.error('处理文件时出错:', err.message);
  process.exit(1);
}
