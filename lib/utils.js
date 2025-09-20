const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const colors = require("colors");
const readline = require("readline");
const commandExists = require('command-exists');

// Configuration constants
const CONFIG = {
  ZIP_EXTENSION: ".zip",
  SIZE_DIFF_THRESHOLD: 0.1,
  CONFIG_DIR: path.join(os.homedir(), '.config', 'za-7z'),
  PASSWORD_FILE: path.join(os.homedir(), '.config', 'za-7z', 'auth.enc'),
  SALT_FILE: path.join(os.homedir(), '.config', 'za-7z', 'salt.key')
};

// Simple encryption/decryption using built-in crypto
function encrypt(text, key) {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, key) {
  try {
    const algorithm = 'aes-256-cbc';
    const keyBuffer = crypto.createHash('sha256').update(key).digest();
    
    // Split IV and encrypted data
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      return null;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

function getMachineKey() {
  // Generate a key based on machine-specific information
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const platform = os.platform();
  return crypto.createHash('sha256').update(`${hostname}-${username}-${platform}`).digest('hex');
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG.CONFIG_DIR)) {
    fs.mkdirSync(CONFIG.CONFIG_DIR, { recursive: true });
  }
}

function saveEncryptedPassword(password) {
  ensureConfigDir();
  const machineKey = getMachineKey();
  const encrypted = encrypt(password, machineKey);
  fs.writeFileSync(CONFIG.PASSWORD_FILE, encrypted, 'utf8');
}

function loadEncryptedPassword() {
  if (!fs.existsSync(CONFIG.PASSWORD_FILE)) {
    return null;
  }
  
  try {
    const encrypted = fs.readFileSync(CONFIG.PASSWORD_FILE, 'utf8');
    const machineKey = getMachineKey();
    return decrypt(encrypted, machineKey);
  } catch (err) {
    return null;
  }
}

function readlinePromise(question) {
  return new Promise((resolve) => {
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

async function getPassword(argv) {
  // Check if password provided via command line
  if (argv.p || argv.password) {
    return argv.p || argv.password;
  }
  
  // Check if encrypted password file exists
  const savedPassword = loadEncryptedPassword();
  if (savedPassword && !argv.reset) {
    console.log(colors.green('Using saved password.'));
    return savedPassword;
  }
  
  // Prompt for password
  const password = await readlinePromise('Please enter password for encryption: ');
  if (!password) {
    console.log(colors.red('Error: Password is required!'));
    process.exit(1);
  }
  
  // Ask if user wants to save password
  const savePassword = await readlinePromise('Do you want to save this password securely for future use? (y/n): ');
  if (savePassword.toLowerCase().startsWith('y')) {
    try {
      saveEncryptedPassword(password);
      console.log(colors.green(`Password saved securely to ${CONFIG.CONFIG_DIR}`));
    } catch (err) {
      console.log(err);
      console.log(colors.yellow('Warning: Could not save password file.'));
    }
  }
  
  return password;
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

function expandGlobPattern(pattern) {
  // Simple glob expansion for * patterns
  if (!pattern.includes('*')) {
    return [pattern];
  }
  
  const parts = pattern.split('*');
  const basePath = parts[0];
  const suffix = parts[1] || '';
  
  // Get the directory path
  const dir = path.dirname(basePath);
  const prefix = path.basename(basePath);
  
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    const files = fs.readdirSync(dir);
    const matchedFiles = files.filter(file => {
      return file.startsWith(prefix) && file.endsWith(suffix);
    });
    
    return matchedFiles.map(file => path.join(dir, file));
  } catch (err) {
    return [];
  }
}

function getTargetFiles(inputPaths, skipZipFiles = false) {
  // Handle array of paths (when shell expands wildcards) or single path
  const paths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  const allFiles = [];
  
  for (const inputPath of paths) {
    // Check if it's a glob pattern that wasn't expanded by shell
    if (inputPath.includes('*') && !fs.existsSync(inputPath)) {
      const files = expandGlobPattern(inputPath);
      allFiles.push(...files.map(file => path.resolve(file)));
    } else {
      // Single file or directory (or shell-expanded file)
      const resolvedPath = path.resolve(inputPath);
      if (fs.existsSync(resolvedPath)) {
        allFiles.push(resolvedPath);
      }
    }
  }
  
  // Filter out zip files if skipZipFiles is true (for compression operations)
  if (skipZipFiles) {
    const filteredFiles = allFiles.filter(file => !file.endsWith(CONFIG.ZIP_EXTENSION));
    const skippedFiles = allFiles.filter(file => file.endsWith(CONFIG.ZIP_EXTENSION));
    
    if (skippedFiles.length > 0) {
      console.log(colors.yellow(`Skipping ${skippedFiles.length} zip file(s):`));
      skippedFiles.forEach((file, index) => {
        console.log(colors.gray(`  ${index + 1}. ${file} (already compressed)`));
      });
    }
    
    return filteredFiles;
  }
  
  return allFiles;
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

function clearSavedPassword() {
  try {
    if (fs.existsSync(CONFIG.PASSWORD_FILE)) {
      fs.unlinkSync(CONFIG.PASSWORD_FILE);
      console.log(colors.green('Saved password cleared successfully!'));
    } else {
      console.log(colors.yellow('No saved password found.'));
    }
  } catch (err) {
    console.log(colors.red('Error clearing saved password:', err.message));
  }
}

function showPasswordInfo() {
  if (fs.existsSync(CONFIG.PASSWORD_FILE)) {
    console.log(colors.green(`Password file exists at: ${CONFIG.PASSWORD_FILE}`));
    console.log(colors.cyan('Use --clear-password to remove saved password'));
  } else {
    console.log(colors.yellow('No saved password found.'));
    console.log(colors.cyan(`Passwords will be saved to: ${CONFIG.CONFIG_DIR}`));
  }
}

function getOutputPath(inputPath, isCompression = true) {
  if (isCompression) {
    return `${inputPath}${CONFIG.ZIP_EXTENSION}`;
  } else {
    // For decompression, remove .zip extension
    if (inputPath.endsWith(CONFIG.ZIP_EXTENSION)) {
      return inputPath.slice(0, -CONFIG.ZIP_EXTENSION.length);
    }
    return inputPath;
  }
}

module.exports = {
  CONFIG,
  readlinePromise,
  getPassword,
  checkCommand,
  expandGlobPattern,
  getTargetFiles,
  confirmAction,
  handleError,
  showVersion,
  clearSavedPassword,
  showPasswordInfo,
  getOutputPath
};