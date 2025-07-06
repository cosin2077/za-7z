const child = require("child_process");
const fs = require("fs");
const path = require("path");
const colors = require("colors");
const argv = require("minimist")(process.argv.slice(2));
const {
  CONFIG,
  checkCommand,
  checkDestDir,
  getListMap,
  confirmAction,
  handleError,
  showVersion
} = require('./utils');

const isDebug = argv.debug || argv.d;
const isConfirm = argv.y || argv.yes;
const sDel = argv.sdel || argv.sDel;

if (isDebug) {
  console.log(colors.blue(argv));
}

if (argv.v || argv.version) {
  showVersion();
}

const commandType = 'x';
const password = argv.p || argv.pass || argv.password || CONFIG.DEFAULT_PASSWORD;

const { destDir, destPath } = checkDestDir(argv);

const zipExecStr = (name, dir) =>
  `7z x "${name}" -p${password} -o"${dir}"`;
function getZipFileList(destPath) {
  const { zipList } = getListMap(destPath);
  return zipList.map((file) => path.resolve(destPath, file));
}

async function extract(file) {
  await confirmAction(
    `Do you want to unzip this file ${file}?`,
    isConfirm
  );
  try {
    const msg = child.execSync(zipExecStr(file, destPath)).toString();
  } catch (err) {
    handleError(err, isDebug);
  }
}

async function runX() {
  await checkCommand("7z", isDebug);
  if (fs.statSync(destPath).isFile()) {
    return await extract(destPath);
  }
  const { rawList, zipList, noZipList } = getListMap(destPath);
  const fileList = getZipFileList(destPath);
  
  console.log(
    "totalList:",
    rawList.length,
    " | zipList:",
    zipList.length,
    " | noZipList:",
    noZipList.length,
    " | fileList:",
    fileList.length
  );
  
  await confirmAction(
    `Do you want to unzip these ${fileList.length} files?`,
    isConfirm
  );
  
  fileList.forEach((file, index) => {
    try {
      console.log(`[${index + 1}/${fileList.length}]`, zipExecStr(file, destPath));
      const msg = child.execSync(zipExecStr(file, destPath)).toString();
      if (sDel) {
        if (isDebug) {
          console.log(`Deleting ${file}`);
        }
        fs.unlinkSync(file);
      }
    } catch (err) {
      handleError(err, isDebug);
    }
  });
}

const runMain = async () => {
  if (isConfirm) {
    console.log('Running za with confirm mode, actions will execute instantly!');
  }
  switch (commandType) {
    case "x":
      await runX();
      break;
    default:
      await runX();
      break;
  }
};

module.exports = {
  run: () => {
    runMain()
      .then(() => {
        process.exit(0);
      })
      .catch(console.log);
  },
};
