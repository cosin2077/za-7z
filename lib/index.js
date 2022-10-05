const child = require("child_process");
const fs = require("fs");
const path = require("path");
const colors = require("colors");
const argv = require("minimist")(process.argv.slice(2));
const readline = require("readline");
var commandExists = require('command-exists');


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

const isDebug = argv.debug || argv.d;
if (isDebug) {
  console.log(colors.blue(argv));
}

const isDelete =
  argv.delete || argv.del || argv._.find((arg) => /del|delete/.test(arg));
const commandType = isDelete ? "delete" : "add";
const password = argv.p || argv.pass || argv.password || "2010";
let destDir;
let destPath;

const zipExecStr = (name) =>
  `7z a "${name}.za.zip" "${name}" -p${password} -mx0`;

const checkCommand = async (command) => {
  try {
    await commandExists(command);
    if (isDebug) console.log(colors.green(`Info: command: ${command} exists!`));
  } catch (err) {
    console.log(colors.red(`Error: Please install ${command} first!`));
    process.exit(1);
  }
};

function checkDestDir() {
  destDir = argv._[0];
  if (!destDir) {
    console.log(colors.red(`Error: dir or file needed!`));
    process.exit(1);
  }
  destPath = path.resolve(process.cwd(), destDir);
  if (!fs.existsSync(destPath)) {
    console.log(colors.red(`Error: dir or file ${destDir} not exists!`));
    process.exit(1);
  }
}
checkDestDir();

function getListMap() {
  let rawList = fs
    .readdirSync(destPath)
    .filter(Boolean)
    .filter((file) => !file.startsWith("."));
  const zipList = rawList.filter((file) => file.endsWith("za.zip"));
  const noZipList = rawList.filter((file) => !file.endsWith("zip"));

  let fileList = noZipList.filter((file) => {
    const zipFile = zipList.find((z) => z.indexOf(file) !== -1);
    if (!zipFile) return true;

    const fileStat = fs.statSync(path.resolve(destPath, file));
    if (fileStat.isDirectory()) return true;

    const zipStat = fs.statSync(path.resolve(destPath, zipFile));
    const percent = Math.abs(fileStat.size - zipStat.size) / fileStat.size;
    return percent > 0.1;
  });
  fileList = fileList.map((file) => path.resolve(destPath, file));
  return {
    rawList,
    zipList,
    noZipList,
    fileList,
  };
}
async function zipFile(file) {
  let anwser = await readlinePromise(
    `du you want to zip this file ${file} files?`
  );
  if (anwser !== "" && !/y|ye(s?)/gim.test(anwser)) {
    console.log("user quit[zipFile]!");
    process.exit(1);
  }
  try {
    const msg = child.execSync(zipExecStr(file)).toString();
  } catch (err) {
    if (debug) console.log(err);
    else console.log(err.message);
  }
}
async function runAdd() {
  await checkCommand("7z");
  if (fs.statSync(destPath).isFile()) {
    return await zipFile(destPath);
  }
  const { rawList, zipList, noZipList, fileList } = getListMap();
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
  let anwser = await readlinePromise(
    `du you want to zip these ${fileList.length} files?`
  );
  if (anwser !== "" && !/y|ye(s?)/gim.test(anwser)) {
    console.log("user quit[runAdd]!");
    process.exit(1);
  }
  fileList.forEach((file, index) => {
    try {
      console.log(`[${index + 1}/${fileList.length}]`, zipExecStr(file));
      const msg = child.execSync(zipExecStr(file)).toString();
    } catch (err) {
      if (debug) {
        console.log(err);
      } else {
        console.log(err.message);
      }
    }
  });
}
async function runDelete() {
  const { zipList } = getListMap();
  if (!zipList.length) {
    console.log(`no files to delete in ${destPath}`);
    process.exit(1);
  }
  let anwser = await readlinePromise(
    `du you want to delete these ${zipList.length} files?`
  );
  if (anwser !== "" && !/y|ye(s?)/gim.test(anwser)) {
    console.log("user quit[runDelete]!");
    process.exit(1);
  }
  zipList.forEach((file, index) => {
    try {
      console.log(`[${index + 1}/${zipList.length}] deleting file: ${file}`);
      const filePath = path.resolve(destPath, file);
      fs.unlinkSync(filePath);
    } catch (err) {
      if (debug) console.log(err);
      else console.log(err.message);
    }
  });
}
const runMain = async () => {
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
