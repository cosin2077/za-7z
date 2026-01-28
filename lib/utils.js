const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const colors = require("colors");
const readline = require("readline");
const commandExists = require('command-exists');
const fastGlob = require('fast-glob');

// Configuration constants
const CONFIG = {
  ZIP_EXTENSION: ".zip",
  SEVENZ_EXTENSION: ".7z",
  SIZE_DIFF_THRESHOLD: 0.1,
  CONFIG_DIR: path.join(os.homedir(), '.config', 'za-7z'),
  PASSWORD_FILE: path.join(os.homedir(), '.config', 'za-7z', 'auth.enc'),
  SALT_FILE: path.join(os.homedir(), '.config', 'za-7z', 'salt.key'),
  SUPPORTED_FORMATS: {
    zip: ".zip",
    '7z': ".7z"
  }
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

async function getTargetFiles(inputPaths, skipCompressedFiles = false) {
  // Handle array of paths (when shell expands wildcards) or single path
  const paths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  const allFiles = [];

  for (const inputPath of paths) {
    // Check if it's a glob pattern that wasn't expanded by shell
    // Detect glob patterns: *, ?, {, **, [, !
    const isGlob = /[*?{\[\!]/.test(inputPath);
    if (isGlob) {
      try {
        // Use fast-glob for advanced pattern matching
        const globFiles = await fastGlob(inputPath, {
          onlyFiles: true,
          absolute: true,
          dot: false
        });
        allFiles.push(...globFiles);
      } catch (err) {
        // If glob fails, skip this pattern
        continue;
      }
    } else {
      // Single file or directory (or shell-expanded file)
      const resolvedPath = path.resolve(inputPath);
      if (fs.existsSync(resolvedPath)) {
        allFiles.push(resolvedPath);
      }
    }
  }

  // Filter out compressed files if skipCompressedFiles is true (for compression operations)
  if (skipCompressedFiles) {
    const compressedExtensions = Object.values(CONFIG.SUPPORTED_FORMATS);
    const filteredFiles = allFiles.filter(file => {
      return !compressedExtensions.some(ext => file.endsWith(ext));
    });
    const skippedFiles = allFiles.filter(file => {
      return compressedExtensions.some(ext => file.endsWith(ext));
    });

    if (skippedFiles.length > 0) {
      console.log(colors.yellow(`Skipping ${skippedFiles.length} compressed file(s):`));
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

function getOutputPath(inputPath, isCompression = true, format = 'zip') {
  if (isCompression) {
    const extension = CONFIG.SUPPORTED_FORMATS[format] || CONFIG.ZIP_EXTENSION;
    return `${inputPath}${extension}`;
  } else {
    // For decompression, remove known extensions
    for (const extension of Object.values(CONFIG.SUPPORTED_FORMATS)) {
      if (inputPath.endsWith(extension)) {
        return inputPath.slice(0, -extension.length);
      }
    }
    return inputPath;
  }
}

function getCompressionFormat(argv) {
  const format = argv.format || argv.f || 'zip';
  if (!CONFIG.SUPPORTED_FORMATS[format]) {
    console.log(colors.red(`Error: Unsupported format "${format}". Supported formats: ${Object.keys(CONFIG.SUPPORTED_FORMATS).join(', ')}`));
    process.exit(1);
  }
  return format;
}

function filterSupportedFiles(files) {
  const supportedExtensions = Object.values(CONFIG.SUPPORTED_FORMATS);
  return files.filter(file => {
    return supportedExtensions.some(ext => file.endsWith(ext));
  });
}

function isCompressedFile(filePath) {
  return Object.values(CONFIG.SUPPORTED_FORMATS).some(ext => filePath.endsWith(ext));
}

module.exports = {
  CONFIG,
  readlinePromise,
  getPassword,
  checkCommand,
  getTargetFiles,
  confirmAction,
  handleError,
  showVersion,
  clearSavedPassword,
  showPasswordInfo,
  getOutputPath,
  getCompressionFormat,
  filterSupportedFiles,
  isCompressedFile
};