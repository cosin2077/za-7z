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
  getFilteredFileList,
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

const isDelete =
  argv.delete || argv.del || argv._.find((arg) => /del|delete/.test(arg));
const commandType = isDelete ? "delete" : "add";
const password = argv.p || argv.pass || argv.password || CONFIG.DEFAULT_PASSWORD;

const { destDir, destPath } = checkDestDir(argv);

const zipExecStr = (name) =>
  `7z a "${name}.${CONFIG.ZIP_EXTENSION}" "${name}" -p${password} -mx0 ${sDel ? '-sdel' : ''}`;
async function zipFile(file) {
  await confirmAction(
    `Do you want to zip this file ${file}?`,
    isConfirm
  );
  try {
    const msg = child.execSync(zipExecStr(file)).toString();
  } catch (err) {
    handleError(err, isDebug);
  }
}

async function runAdd() {
  await checkCommand("7z", isDebug);
  if (fs.statSync(destPath).isFile()) {
    return await zipFile(destPath);
  }
  const { rawList, zipList, noZipList } = getListMap(destPath);
  const fileList = getFilteredFileList(destPath);
  
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
    `Do you want to zip these ${fileList.length} files?`,
    isConfirm
  );
  
  fileList.forEach((file, index) => {
    try {
      console.log(`[${index + 1}/${fileList.length}]`, zipExecStr(file));
      const msg = child.execSync(zipExecStr(file)).toString();
    } catch (err) {
      handleError(err, isDebug);
    }
  });
}

async function runDelete() {
  const { zipList } = getListMap(destPath);
  if (!zipList.length) {
    console.log(`No files to delete in ${destPath}`);
    process.exit(1);
  }
  
  await confirmAction(
    `Do you want to delete these ${zipList.length} files?`,
    isConfirm
  );
  
  zipList.forEach((file, index) => {
    try {
      console.log(`[${index + 1}/${zipList.length}] Deleting file: ${file}`);
      const filePath = path.resolve(destPath, file);
      fs.unlinkSync(filePath);
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
    case "delete":
      await runDelete();
      break;
    case "add":
    default:
      await runAdd();
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
