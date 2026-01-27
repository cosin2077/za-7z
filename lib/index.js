const child = require("child_process");
const fs = require("fs");
const colors = require("colors");
const argv = require("minimist")(process.argv.slice(2));
const {
  getPassword,
  checkCommand,
  getTargetFiles,
  confirmAction,
  handleError,
  showVersion,
  clearSavedPassword,
  showPasswordInfo,
  getOutputPath,
  getCompressionFormat
} = require('./utils');

const isDebug = argv.debug || argv.d;
const isConfirm = argv.y || argv.yes;
const shouldDelete = argv.del || argv.sdel;
const isFast = argv.fast;
const format = getCompressionFormat(argv);

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
    console.log(colors.red('Error: Please specify a file or directory to compress!'));
    console.log(colors.cyan('Usage: za <file|directory|pattern> [options]'));
    console.log(colors.cyan('Examples:'));
    console.log(colors.cyan('  za .test                # Compress .test directory to zip'));
    console.log(colors.cyan('  za .test -f 7z          # Compress .test directory to 7z'));
    console.log(colors.cyan('  za .test/*              # Compress all files in .test directory'));
    console.log(colors.cyan('  za file.txt             # Compress single file'));
    console.log(colors.cyan(''));
    console.log(colors.cyan('Options:'));
    console.log(colors.cyan('  -f, --format <format>   Compression format (zip, 7z) [default: zip]'));
    console.log(colors.cyan('  -p, --password <pwd>    Specify password'));
    console.log(colors.cyan('  --fast                  Use fastest compression (mx0, no compression)'));
    console.log(colors.cyan('  --del, --sdel           Delete source files after compression'));
    console.log(colors.cyan('  -y, --yes               Auto-confirm all operations'));
    console.log(colors.cyan('  --clear-password        Clear saved password'));
    console.log(colors.cyan('  --password-info         Show password storage info'));
    console.log(colors.cyan('  --force                 Include all files, including compressed files'));
    console.log(colors.cyan('  --debug                 Show debug information'));
    process.exit(1);
  }

  // Get password
  const password = await getPassword(argv);
  
  // Check if 7z command exists
  await checkCommand("7z", isDebug);

  // Get target files - handle both single path and multiple paths from shell expansion
  // Skip compressed files to avoid compressing already compressed files
  const targetFiles = getTargetFiles(targetPaths, argv.force ? false : true);
  
  if (targetFiles.length === 0) {
    console.log(colors.red(`Error: No files found matching pattern: ${targetPaths.join(', ')}`));
    process.exit(1);
  }

  console.log(colors.green(`Found ${targetFiles.length} file(s) to compress to ${format.toUpperCase()}:`));
  targetFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  // Show deletion warning if --del is specified
  if (shouldDelete) {
    console.log('');
    console.log(colors.yellow('⚠️  WARNING: Source files will be deleted after successful compression!'));
    console.log(colors.red('Files that will be deleted:'));
    targetFiles.forEach((file, index) => {
      console.log(colors.red(`  ${index + 1}. ${file}`));
    });
    console.log('');
  }

  // Confirm operation
  const confirmMessage = shouldDelete 
    ? `Do you want to compress these ${targetFiles.length} file(s) and DELETE the source files? (y/n): `
    : `Do you want to compress these ${targetFiles.length} file(s)? (y/n): `;
  
  await confirmAction(confirmMessage, isConfirm);

  // Compress each file
  for (let i = 0; i < targetFiles.length; i++) {
    const inputPath = targetFiles[i];
    const outputPath = getOutputPath(inputPath, true, format);

    console.log(colors.blue(`[${i + 1}/${targetFiles.length}] Compressing: ${inputPath}`));

    try {
      // Use different compression types based on format
      let command;
      const compressionLevel = isFast ? '-mx0' : '-mx9';
      if (format === '7z') {
        command = `7z a -t7z "${outputPath}" "${inputPath}" -p${password} ${compressionLevel}`;
      } else {
        command = `7z a "${outputPath}" "${inputPath}" -p${password} ${compressionLevel}`;
      }

      if (isDebug) {
        console.log(colors.gray(`Command: ${command.replace(`-p${password}`, '-p***')}`));
      }

      child.execSync(command, { stdio: isDebug ? 'inherit' : 'pipe' });

      if (fs.existsSync(outputPath)) {
        console.log(colors.green(`✓ Successfully compressed to ${format.toUpperCase()}: ${outputPath}`));

        // Delete source file if requested
        if (shouldDelete) {
          try {
            if (fs.statSync(inputPath).isDirectory()) {
              fs.rmSync(inputPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(inputPath);
            }
            console.log(colors.yellow(`  Deleted source: ${inputPath}`));
          } catch (delErr) {
            console.log(colors.red(`  Warning: Could not delete source: ${delErr.message}`));
          }
        }
      } else {
        console.log(colors.red(`✗ Failed to create: ${outputPath}`));
      }
    } catch (err) {
      console.log(colors.red(`✗ Error compressing ${inputPath}:`));
      handleError(err, isDebug);
    }
  }

  console.log(colors.green('Compression completed!'));
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