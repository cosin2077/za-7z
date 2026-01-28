#!/usr/bin/env node

/**
 * Fast-glob 集成测试
 * 测试各种 glob 模式的文件匹配
 */

const fs = require('fs');
const path = require('path');
const { getTargetFiles } = require('../lib/utils');

// ANSI 颜色
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// 测试结果统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * 断言函数
 */
function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(colors.green(`  ✓ ${message}`));
  } else {
    failedTests++;
    console.log(colors.red(`  ✗ ${message}`));
  }
}

/**
 * 创建测试文件结构
 */
function setupTestFiles() {
  const testDir = path.join(__dirname, 'fixtures');

  // 创建测试目录结构
  const structure = {
    'test': {
      'file1.txt': 'content1',
      'file2.txt': 'content2',
      'data.json': '{}',
      'script.js': 'console.log();',
      'song1.mp3': 'audio',
      'song2.mp3': 'audio',
      'video.mp4': 'video',
      'mp4file.mov': 'mov',
      'mp4video.mp4': 'mp4',
      'archive.zip': 'zip',
      'backup.7z': '7z',
      'subdir': {
        'nested.txt': 'nested',
        'deep': {
          'file.txt': 'deep'
        }
      }
    }
  };

  function createDir(base, structure) {
    if (!fs.existsSync(base)) {
      fs.mkdirSync(base, { recursive: true });
    }
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(base, name);
      if (typeof content === 'object') {
        createDir(fullPath, content);
      } else {
        fs.writeFileSync(fullPath, content);
      }
    }
  }

  createDir(testDir, structure);
  return testDir;
}

/**
 * 清理测试文件
 */
function cleanupTestFiles(testDir) {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/**
 * 运行测试
 */
async function runTests() {
  console.log(colors.cyan('\n🧪 Fast-glob 集成测试\n'));

  const testDir = setupTestFiles();
  const originalDir = process.cwd();
  process.chdir(testDir);

  try {
    // 测试 1: 基本通配符 *
    console.log(colors.yellow('测试 1: 基本通配符 *'));
    const test1 = await getTargetFiles(['test/*.txt'], false);
    assert(test1.length === 2, '匹配 2 个 .txt 文件');
    assert(test1.some(f => f.endsWith('file1.txt')), '匹配 file1.txt');
    assert(test1.some(f => f.endsWith('file2.txt')), '匹配 file2.txt');

    // 测试 2: 后缀通配符 *.txt
    console.log(colors.yellow('\n测试 2: 后缀通配符 *.mp3'));
    const test2 = await getTargetFiles(['test/*.mp3'], false);
    assert(test2.length === 2, '匹配 2 个 .mp3 文件');
    assert(test2.some(f => f.endsWith('song1.mp3')), '匹配 song1.mp3');

    // 测试 3: 前缀通配符 mp4*
    console.log(colors.yellow('\n测试 3: 前缀通配符 mp4*'));
    const test3 = await getTargetFiles(['test/mp4*'], false);
    assert(test3.length === 2, '匹配 2 个以 mp4 开头的文件');
    assert(test3.some(f => f.endsWith('mp4file.mov')), '匹配 mp4file.mov');
    assert(test3.some(f => f.endsWith('mp4video.mp4')), '匹配 mp4video.mp4');

    // 测试 4: 递归通配符 ** (fast-glob 特性)
    console.log(colors.yellow('\n测试 4: 递归通配符 **'));
    const test4 = await getTargetFiles(['test/**/*.txt'], false);
    assert(test4.length >= 3, '匹配所有子目录的 .txt 文件');
    assert(test4.some(f => f.endsWith('nested.txt')), '匹配嵌套的 nested.txt');
    assert(test4.some(f => f.endsWith('file.txt')), '匹配深层 file.txt');

    // 测试 5: 多扩展名 {js,ts} (fast-glob 特性)
    console.log(colors.yellow('\n测试 5: 扩展 glob {js,json}'));
    const test5 = await getTargetFiles(['test/*.{js,json}'], false);
    assert(test5.length === 2, '匹配 2 个扩展名文件');
    assert(test5.some(f => f.endsWith('script.js')), '匹配 .js 文件');
    assert(test5.some(f => f.endsWith('data.json')), '匹配 .json 文件');

    // 测试 6: 字符类 [0-9] (fast-glob 特性)
    console.log(colors.yellow('\n测试 6: 字符类 song[1-2].mp3'));
    const test6 = await getTargetFiles(['test/song[1-2].mp3'], false);
    if (test6.length !== 2) {
      console.log(colors.gray(`    实际结果: ${test6.map(f => path.basename(f)).join(', ')}`));
    }
    assert(test6.length === 2, '匹配 song1.mp3 和 song2.mp3');

    // 测试 7: 过滤压缩文件
    console.log(colors.yellow('\n测试 7: 过滤压缩文件'));
    const test7 = await getTargetFiles(['test/*'], true);
    assert(!test7.some(f => f.endsWith('.zip')), '过滤 .zip 文件');
    assert(!test7.some(f => f.endsWith('.7z')), '过滤 .7z 文件');
    assert(test7.some(f => f.endsWith('.txt')), '保留 .txt 文件');

    // 测试 8: 单个文件路径
    console.log(colors.yellow('\n测试 8: 单个文件路径'));
    const test8 = await getTargetFiles(['test/file1.txt'], false);
    assert(test8.length === 1, '匹配 1 个文件');
    assert(test8[0].endsWith('file1.txt'), '匹配 file1.txt');

    // 测试 9: 多个路径
    console.log(colors.yellow('\n测试 9: 多个路径'));
    const test9 = await getTargetFiles(['test/*.mp3', 'test/*.mp4'], false);
    if (test9.length !== 4) {
      console.log(colors.gray(`    实际结果: ${test9.map(f => path.basename(f)).join(', ')}`));
    }
    assert(test9.length === 4, '匹配 4 个文件 (2个mp3 + 2个mp4)');

    // 测试 10: 不存在的模式
    console.log(colors.yellow('\n测试 10: 不存在的模式'));
    const test10 = await getTargetFiles(['test/*.xyz'], false);
    assert(test10.length === 0, '返回空数组');

    // 测试 11: 布尔组合 - 匹配并过滤
    console.log(colors.yellow('\n测试 11: 手动过滤 .zip 文件'));
    const test11All = await getTargetFiles(['test/*'], false);
    const test11 = test11All.filter(f => !f.endsWith('.zip'));
    if (test11.some(f => f.endsWith('.zip'))) {
      console.log(colors.gray(`    发现 .zip 文件: ${test11.filter(f => f.endsWith('.zip')).map(f => path.basename(f)).join(', ')}`));
    }
    assert(!test11.some(f => f.endsWith('.zip')), '排除 .zip 文件');
    assert(test11.some(f => f.endsWith('.txt')), '保留其他文件');

  } finally {
    process.chdir(originalDir);
    cleanupTestFiles(testDir);
  }

  // 输出测试结果
  console.log(colors.cyan('\n📊 测试结果统计\n'));
  console.log(`  总计: ${totalTests}`);
  console.log(colors.green(`  通过: ${passedTests}`));
  if (failedTests > 0) {
    console.log(colors.red(`  失败: ${failedTests}`));
  }

  if (failedTests === 0) {
    console.log(colors.green('\n✅ 所有测试通过！\n'));
    process.exit(0);
  } else {
    console.log(colors.red('\n❌ 部分测试失败\n'));
    process.exit(1);
  }
}

// 运行测试
runTests().catch(err => {
  console.error(colors.red(`错误: ${err.message}`));
  process.exit(1);
});
