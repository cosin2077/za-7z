const child = require("child_process");
const fs = require("fs");
const path = require("path");
const colors = require("colors");
const argv = require("minimist")(process.argv.slice(2));
const {
  CONFIG,
  getPassword,
  checkCommand,
  getTargetFiles,
  confirmAction,
  handleError,
  showVersion,
  clearSavedPassword,
  showPasswordInfo,
  getOutputPath,
  filterSupportedFiles
} = require('./utils');

const isDebug = argv.debug || argv.d;
const isConfirm = argv.y || argv.yes;
const shouldDelete = argv.del || argv.sdel;

if (isDebug) {
  console.log(colors.blue(argv));
}

if (argv.v || argv.version) {
  showVersion();
}

// Handle password management commands
if (argv['clear-password']) {
  clearSavedPassword();
  process.exit(0);
}

if (argv['password-info']) {
  showPasswordInfo();
  process.exit(0);
}

async function main() {
  // Check if target path is provided
  const targetPaths = argv._;
  if (!targetPaths || targetPaths.length === 0) {
    console.log(colors.red('Error: Please specify a compressed file or pattern to extract!'));
    console.log(colors.cyan('Usage: zx <file.(zip|7z)|pattern> [options]'));
    console.log(colors.cyan('Examples:'));
    console.log(colors.cyan('  zx .test.zip        # Extract .test.zip to .test'));
    console.log(colors.cyan('  zx .test.7z         # Extract .test.7z to .test'));
    console.log(colors.cyan('  zx .test/*.zip      # Extract all zip files in .test directory'));
    console.log(colors.cyan('  zx .test/*.7z       # Extract all 7z files in .test directory'));
    console.log(colors.cyan('  zx file.txt.zip     # Extract single file'));
    console.log(colors.cyan(''));
    console.log(colors.cyan('Options:'));
    console.log(colors.cyan('  -p, --password <pwd>    Specify password'));
    console.log(colors.cyan('  --del, --sdel           Delete compressed files after extraction'));
    console.log(colors.cyan('  -y, --yes               Auto-confirm all operations'));
    console.log(colors.cyan('  --clear-password        Clear saved password'));
    console.log(colors.cyan('  --password-info         Show password storage info'));
    console.log(colors.cyan('  --debug                 Show debug information'));
    process.exit(1);
  }

  // Get password
  const password = await getPassword(argv);
  
  // Check if 7z command exists
  await checkCommand("7z", isDebug);

  // Get target files (should be compressed files) - handle both single path and multiple paths from shell expansion
  const targetFiles = getTargetFiles(targetPaths);

  // Filter only supported compressed files
  const compressedFiles = filterSupportedFiles(targetFiles);

  if (compressedFiles.length === 0) {
    console.log(colors.red(`Error: No supported compressed files found matching pattern: ${targetPaths.join(', ')}`));
    console.log(colors.yellow(`Supported formats: ${Object.keys(CONFIG.SUPPORTED_FORMATS).join(', ')}`));
    process.exit(1);
  }

  console.log(colors.green(`Found ${compressedFiles.length} compressed file(s) to extract:`));
  compressedFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  // Show deletion warning if --del is specified
  if (shouldDelete) {
    console.log('');
    console.log(colors.yellow('⚠️  WARNING: Compressed files will be deleted after successful extraction!'));
    console.log(colors.red('Compressed files that will be deleted:'));
    compressedFiles.forEach((file, index) => {
      console.log(colors.red(`  ${index + 1}. ${file}`));
    });
    console.log('');
  }

  // Confirm operation
  const confirmMessage = shouldDelete
    ? `Do you want to extract these ${compressedFiles.length} file(s) and DELETE the compressed files? (y/n): `
    : `Do you want to extract these ${compressedFiles.length} file(s)? (y/n): `;

  await confirmAction(confirmMessage, isConfirm);

  // Extract each file
  for (let i = 0; i < compressedFiles.length; i++) {
    const filePath = compressedFiles[i];
    const outputPath = getOutputPath(filePath, false);

    console.log(colors.blue(`[${i + 1}/${compressedFiles.length}] Extracting: ${filePath}`));
    
    try {
      // Create output directory if it doesn't exist (for directory extraction)
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const command = `7z x "${filePath}" -p${password} -o"${outputDir}" -y`;
      if (isDebug) {
        console.log(colors.gray(`Command: ${command.replace(`-p${password}`, '-p***')}`));
      }

      child.execSync(command, { stdio: isDebug ? 'inherit' : 'pipe' });

      console.log(colors.green(`✓ Successfully extracted: ${filePath}`));

      // Delete compressed file if requested
      if (shouldDelete) {
        try {
          fs.unlinkSync(filePath);
          console.log(colors.yellow(`  Deleted compressed file: ${filePath}`));
        } catch (delErr) {
          console.log(colors.red(`  Warning: Could not delete compressed file: ${delErr.message}`));
        }
      }
    } catch (err) {
      console.log(colors.red(`✗ Error extracting ${filePath}:`));
      handleError(err, isDebug);
    }
  }

  console.log(colors.green('Extraction completed!'));
}

module.exports = {
  run: () => {
    main()
      .then(() => {
        process.exit(0);
      })
      .catch((err) => {
        console.log(colors.red('Error:', err.message));
        process.exit(1);
      });
  },
};