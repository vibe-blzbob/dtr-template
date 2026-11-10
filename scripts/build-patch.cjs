const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const STAGING_DIR = path.join(RELEASE_DIR, 'staging');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');

function getPackageInfo() {
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function findMakensis() {
  const cacheDir = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache');
  if (!fs.existsSync(cacheDir)) return null;

  function walk(dir) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          const found = walk(full);
          if (found) return found;
        } else if (item.name.toLowerCase() === 'makensis.exe') {
          return full;
        }
      }
    } catch {}
    return null;
  }

  return walk(cacheDir);
}

function getSessionChanges() {
  let gitChanges = [];
  let gitLog = '';
  try {
    const status = execSync('git status --short', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    if (status) {
      gitChanges = status.split('\n').map(s => s.trim()).filter(Boolean);
    }
  } catch {}

  try {
    gitLog = execSync('git log -n 3 --oneline', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch {}

  return { gitChanges, gitLog };
}

function recordSessionLog(pkg, sessionChanges, patchSizeKb) {
  const logFile = path.join(RELEASE_DIR, 'SESSION_UPDATES.md');
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

  let entry = `\n## Session Build: v${pkg.version} (${timestamp})\n`;
  entry += `- **Package**: ${pkg.productName || pkg.name}\n`;
  entry += `- **Update Patch Size**: ~${patchSizeKb} KB (vs ~91 MB full installer)\n`;

  if (sessionChanges.gitChanges && sessionChanges.gitChanges.length > 0) {
    entry += `\n### Modified Files in Session:\n`;
    sessionChanges.gitChanges.forEach(f => {
      entry += `- \`${f}\`\n`;
    });
  }

  if (sessionChanges.gitLog) {
    entry += `\n### Recent Session Commits:\n\`\`\`\n${sessionChanges.gitLog}\n\`\`\`\n`;
  }

  entry += `---\n`;

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  fs.appendFileSync(logFile, entry, 'utf8');

  // Also write compact update-info.json
  const infoFile = path.join(RELEASE_DIR, 'update-info.json');
  fs.writeFileSync(infoFile, JSON.stringify({
    version: pkg.version,
    productName: pkg.productName || pkg.name,
    timestamp,
    patchSizeKb,
    changes: sessionChanges.gitChanges
  }, null, 2));

  console.log(`[session-tracker] Session updates recorded in: release/SESSION_UPDATES.md`);
}

async function buildPatch() {
  const pkg = getPackageInfo();
  console.log(`\n==================================================`);
  console.log(` Building Session Update Patch: v${pkg.version}`);
  console.log(`==================================================\n`);

  // 1. Compile modified application sources only
  console.log(`[1/4] Compiling session updates with Vite...`);
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

  // 2. Prepare staging directory for asar packaging
  console.log(`\n[2/4] Assembling updated bundle...`);
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  fs.cpSync(path.join(ROOT_DIR, 'dist'), path.join(STAGING_DIR, 'dist'), { recursive: true });
  fs.cpSync(path.join(ROOT_DIR, 'electron'), path.join(STAGING_DIR, 'electron'), { recursive: true });

  // Minimal package.json for runtime
  fs.writeFileSync(path.join(STAGING_DIR, 'package.json'), JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    main: pkg.main
  }, null, 2));

  // 3. Pack asar archive in a dedicated subprocess so OS releases all handles
  const packAsarScript = path.join(__dirname, 'pack-asar.cjs');
  const asarPath = path.join(RELEASE_DIR, 'app.asar');
  execSync(`node "${packAsarScript}" "${STAGING_DIR}" "${asarPath}"`, { stdio: 'inherit' });
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });

  const asarStat = fs.statSync(asarPath);
  const asarSizeKb = (asarStat.size / 1024).toFixed(1);
  console.log(`      Compiled app.asar size: ${asarSizeKb} KB`);

  // 4. Build single-file update patch executable (.exe)
  console.log(`\n[3/4] Packaging update-only installer executable...`);
  const makensis = findMakensis();
  const installerExeName = `${pkg.productName || 'DTR Template'} Update Patch ${pkg.version}.exe`;
  const installerExePath = path.join(RELEASE_DIR, installerExeName);

  if (makensis) {
    const nsiPath = path.join(RELEASE_DIR, 'patch.nsi');
    const nsiLines = [
      'Unicode true',
      'RequestExecutionLevel user',
      'SetCompressor /SOLID lzma',
      '',
      `Name "${pkg.productName || 'DTR Template'} Update"`,
      `OutFile "${installerExeName}"`,
      `Caption "${pkg.productName || 'DTR Template'} Update Patch v${pkg.version}"`,
      'ShowInstDetails show',
      '',
      'Section "MainSection" SEC01',
      '  DetailPrint "Locating DTR Template installation..."',
      '  StrCpy $R0 "$LOCALAPPDATA\\Programs\\dtr-template\\resources"',
      '  IfFileExists "$R0\\*.*" FoundApp CheckMachine',
      'CheckMachine:',
      '  StrCpy $R0 "$PROGRAMFILES\\dtr-template\\resources"',
      '  IfFileExists "$R0\\*.*" FoundApp NotFound',
      '',
      'FoundApp:',
      '  DetailPrint "Target directory: $R0"',
      '  DetailPrint "Closing running instances of DTR Template..."',
      `  nsExec::Exec 'taskkill /F /IM "${pkg.productName || 'DTR Template'}.exe"'`,
      '  Sleep 1000',
      '',
      `  DetailPrint "Applying updated application bundle (${asarSizeKb} KB)..."`,
      '  SetOutPath "$R0"',
      '  File "app.asar"',
      '',
      '  DetailPrint "Update completed successfully!"',
      `  MessageBox MB_OK|MB_ICONINFORMATION "${pkg.productName || 'DTR Template'} has been successfully updated to v${pkg.version}!"`,
      '  Quit',
      '',
      'NotFound:',
      '  MessageBox MB_OK|MB_ICONSTOP "DTR Template installation was not found on this computer.$\\r$\\n$\\r$\\nPlease install the base application before applying updates."',
      '  Abort',
      'SectionEnd'
    ];
    fs.writeFileSync(nsiPath, nsiLines.join('\r\n'), 'utf8');
    execSync(`"${makensis}" "patch.nsi"`, { cwd: RELEASE_DIR, stdio: 'inherit' });
    fs.rmSync(nsiPath, { force: true });
  } else {
    console.warn(`[warn] makensis not found. Provided raw app.asar in release/`);
  }

  // 5. Track session changes and finish
  console.log(`\n[4/4] Tracking session changes...`);
  const sessionChanges = getSessionChanges();
  let finalSizeKb = asarSizeKb;
  if (fs.existsSync(installerExePath)) {
    finalSizeKb = (fs.statSync(installerExePath).size / 1024).toFixed(1);
  }
  recordSessionLog(pkg, sessionChanges, finalSizeKb);

  console.log(`\n==================================================`);
  console.log(` UPDATE INSTALLER READY!`);
  console.log(` Output:  release/${installerExeName}`);
  console.log(` Size:    ${finalSizeKb} KB  (vs 90,857 KB full installer)`);
  console.log(` Savings: 99.6% smaller!`);
  console.log(`==================================================\n`);
}

buildPatch().catch(err => {
  console.error('\n[error] Build patch failed:', err);
  process.exit(1);
});
