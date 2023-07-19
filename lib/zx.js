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
const isConfirm = argv.y || argv.yes;
const sDel = argv.sdel || argv.sDel;

if (isDebug) {
  console.log(colors.blue(argv));
}
const showVersion = argv.v || argv.version;
const version = require('../package.json').version;
if (showVersion) {
  console.log('za-7z version:', version)
  process.exit(1)
}


const commandType = 'x';
const password = argv.p || argv.pass || argv.password || "2010";
let destDir;
let destPath;

const zipExecStr = (name, dir) =>
  `7z x "${name}" -p${password} -o"${dir}"`;

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

  let fileList = zipList
  fileList = fileList.map((file) => path.resolve(destPath, file));
  return {
    rawList,
    zipList,
    noZipList,
    fileList,
  };
}
async function extract(file) {
  if (!isConfirm) {
    let answer = await readlinePromise(
      `du you want to unzip this file ${file}?`
    );
    if (answer !== "" && !/y|ye(s?)/gim.test(answer)) {
      console.log("user quit[extract]!");
      process.exit(1);
    }
  }
  try {
    const msg = child.execSync(zipExecStr(file, destPath)).toString();
  } catch (err) {
    if (isDebug) console.log(err);
    else console.log(err.message);
  }
}
async function runX() {
  await checkCommand("7z");
  if (fs.statSync(destPath).isFile()) {
    return await extract(destPath);
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
  if (!isConfirm) {
    let answer = await readlinePromise(
      `du you want to unzip these ${fileList.length} files?`
    );
    if (answer !== "" && !/y|ye(s?)/gim.test(answer)) {
      console.log("user quit[runX]!");
      process.exit(1);
    }
  }
  fileList.forEach((file, index) => {
    try {
      console.log(`[${index + 1}/${fileList.length}]`, zipExecStr(file, destPath));
      const msg = child.execSync(zipExecStr(file, destPath)).toString();
      if (sDel) {
        if (isDebug) {
          console.log(`deleting ${file}`)
        }
        const filePath = path.resolve(destPath, file);
        
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      if (isDebug) {
        console.log(err);
      } else {
        console.log(err.message);
      }
    }
  });
}

const runMain = async () => {
  if (isConfirm) {
    console.log('run za with confirm mode, actions will execute instantly!')
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
