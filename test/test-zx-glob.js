#!/usr/bin/env node

/**
 * zx 命令 glob 模式测试
 * 测试解压工具的文件模式匹配
 */

const fs = require('fs');
const path = require('path');
const { getTargetFiles, filterSupportedFiles, CONFIG } = require('../lib/utils');

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
  const testDir = path.join(__dirname, 'fixtures-zx');

  const structure = {
    'test': {
      'archive1.zip': 'zip1',
      'archive2.zip': 'zip2',
      'backup.7z': '7z',
      'data.txt': 'text',
      'script.js': 'code',
      'old-backup.zip': 'old',
      'data[1].zip': 'bracket',
      'subdir': {
        'nested.zip': 'nested',
        'data.7z': 'nested7z',
        'file.txt': 'text'
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
  console.log(colors.cyan('\n🧪 ZX 解压工具 Glob 测试\n'));

  const testDir = setupTestFiles();
  const originalDir = process.cwd();
  process.chdir(testDir);

  try {
    // 测试 1: 匹配所有 .zip 文件
    console.log(colors.yellow('测试 1: 匹配所有 .zip 文件'));
    const test1Files = await getTargetFiles(['test/*.zip'], false);
    const test1 = filterSupportedFiles(test1Files);
    if (test1.length !== 4) {
      console.log(colors.gray(`    实际结果: ${test1.map(f => path.basename(f)).join(', ')}`));
    }
    assert(test1.length === 4, '匹配 4 个 .zip 文件');
    assert(test1.some(f => f.endsWith('archive1.zip')), '匹配 archive1.zip');

    // 测试 2: 匹配所有 .7z 文件
    console.log(colors.yellow('\n测试 2: 匹配所有 .7z 文件'));
    const test2Files = await getTargetFiles(['test/*.7z'], false);
    const test2 = filterSupportedFiles(test2Files);
    assert(test2.length === 1, '匹配 1 个 .7z 文件');
    assert(test2[0].endsWith('backup.7z'), '匹配 backup.7z');

    // 测试 3: 递归匹配所有压缩文件
    console.log(colors.yellow('\n测试 3: 递归匹配 **/*.zip'));
    const test3Files = await getTargetFiles(['test/**/*.zip'], false);
    const test3 = filterSupportedFiles(test3Files);
    assert(test3.length >= 4, '匹配至少 4 个 .zip 文件（包括子目录）');
    assert(test3.some(f => f.endsWith('nested.zip')), '匹配嵌套的 nested.zip');

    // 测试 4: 字符类模式
    console.log(colors.yellow('\n测试 4: 字符类 archive[1-2].zip'));
    const test4Files = await getTargetFiles(['test/archive[1-2].zip'], false);
    const test4 = filterSupportedFiles(test4Files);
    assert(test4.length === 2, '匹配 2 个 archive 文件');

    // 测试 5: 混合扩展名
    console.log(colors.yellow('\n测试 5: 混合扩展名 *.{zip,7z}'));
    const test5Files = await getTargetFiles(['test/*.{zip,7z}'], false);
    const test5 = filterSupportedFiles(test5Files);
    if (test5.length !== 5) {
      console.log(colors.gray(`    实际结果: ${test5.map(f => path.basename(f)).join(', ')}`));
    }
    assert(test5.length === 5, '匹配 5 个压缩文件（4个zip + 1个7z）');

    // 测试 6: 包含方括号的文件名
    console.log(colors.yellow('\n测试 6: 包含方括号的文件名 data[1].zip'));
    const test6Files = await getTargetFiles(['test/data[1].zip'], false);
    const test6 = filterSupportedFiles(test6Files);
    assert(test6.length === 1, '匹配 1 个文件');
    assert(test6[0].endsWith('data[1].zip'), '正确匹配 data[1].zip');

    // 测试 7: 过滤非压缩文件
    console.log(colors.yellow('\n测试 7: 过滤非压缩文件'));
    const test7Files = await getTargetFiles(['test/*'], false);
    const test7 = filterSupportedFiles(test7Files);
    assert(!test7.some(f => f.endsWith('.txt')), '过滤 .txt 文件');
    assert(!test7.some(f => f.endsWith('.js')), '过滤 .js 文件');
    assert(test7.some(f => f.endsWith('.zip')), '保留 .zip 文件');
    assert(test7.some(f => f.endsWith('.7z')), '保留 .7z 文件');

    // 测试 8: 多个模式
    console.log(colors.yellow('\n测试 8: 多个模式 *.zip 和 *.7z'));
    const test8Files = await getTargetFiles(['test/*.zip', 'test/*.7z'], false);
    const test8 = filterSupportedFiles(test8Files);
    if (test8.length !== 5) {
      console.log(colors.gray(`    实际结果: ${test8.map(f => path.basename(f)).join(', ')}`));
    }
    assert(test8.length === 5, '匹配 5 个压缩文件（4个zip + 1个7z）');

    // 测试 9: 前缀通配符
    console.log(colors.yellow('\n测试 9: 前缀通配符 archive*.zip'));
    const test9Files = await getTargetFiles(['test/archive*.zip'], false);
    const test9 = filterSupportedFiles(test9Files);
    assert(test9.length === 2, '匹配 2 个 archive 开头的文件');

    // 测试 10: 单个文件
    console.log(colors.yellow('\n测试 10: 单个文件路径'));
    const test10Files = await getTargetFiles(['test/archive1.zip'], false);
    const test10 = filterSupportedFiles(test10Files);
    assert(test10.length === 1, '匹配 1 个文件');
    assert(test10[0].endsWith('archive1.zip'), '匹配 archive1.zip');

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
