const fs = require("fs");
const path = require("path");
const colors = require("colors");
const readline = require("readline");
const commandExists = require('command-exists');

// Configuration constants
const CONFIG = {
  DEFAULT_PASSWORD: "2010",
  ZIP_EXTENSION: "za.zip",
  SIZE_DIFF_THRESHOLD: 0.1
};

function readlinePromise(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (data) => {
      rl.close();
      resolve(data);
    });
  });
}

async function checkCommand(command, isDebug = false) {
  try {
    await commandExists(command);
    if (isDebug) console.log(colors.green(`Info: command: ${command} exists!`));
  } catch (err) {
    console.log(colors.red(`Error: Please install ${command} first!`));
    process.exit(1);
  }
}

function checkDestDir(argv) {
  const destDir = argv._[0];
  if (!destDir) {
    console.log(colors.red(`Error: dir or file needed!`));
    process.exit(1);
  }
  const destPath = path.resolve(process.cwd(), destDir);
  if (!fs.existsSync(destPath)) {
    console.log(colors.red(`Error: dir or file ${destDir} not exists!`));
    process.exit(1);
  }
  return { destDir, destPath };
}

function getListMap(destPath) {
  const rawList = fs
    .readdirSync(destPath)
    .filter(Boolean)
    .filter((file) => !file.startsWith("."));
  const zipList = rawList.filter((file) => file.endsWith(CONFIG.ZIP_EXTENSION));
  const noZipList = rawList.filter((file) => !file.endsWith("zip"));

  return {
    rawList,
    zipList,
    noZipList,
  };
}

function getFilteredFileList(destPath) {
  const { rawList, zipList, noZipList } = getListMap(destPath);
  
  const fileList = noZipList.filter((file) => {
    const zipFile = zipList.find((z) => z.indexOf(file) !== -1);
    if (!zipFile) return true;

    const fileStat = fs.statSync(path.resolve(destPath, file));
    if (fileStat.isDirectory()) return true;

    const zipStat = fs.statSync(path.resolve(destPath, zipFile));
    const percent = Math.abs(fileStat.size - zipStat.size) / fileStat.size;
    return percent > CONFIG.SIZE_DIFF_THRESHOLD;
  });

  return fileList.map((file) => path.resolve(destPath, file));
}

async function confirmAction(message, isConfirm) {
  if (!isConfirm) {
    const answer = await readlinePromise(message);
    if (answer !== "" && !/y|ye(s?)/gim.test(answer)) {
      console.log("Operation cancelled by user!");
      process.exit(1);
    }
  }
}

function handleError(err, isDebug) {
  if (isDebug) {
    console.log(err);
  } else {
    console.log(err.message);
  }
}

function showVersion() {
  const version = require('../package.json').version;
  console.log('za-7z version:', version);
  process.exit(0);
}

module.exports = {
  CONFIG,
  readlinePromise,
  checkCommand,
  checkDestDir,
  getListMap,
  getFilteredFileList,
  confirmAction,
  handleError,
  showVersion
};