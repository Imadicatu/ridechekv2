/**
 * ==============================================================================
 * RideCheck — Automated Git Sync & Auto-Deploy Watcher
 * ==============================================================================
 * ทำหน้าที่ตรวจจับการบันทึกไฟล์ (Save) ภายในโปรเจกต์ แล้วทำ Commit & Push
 * ขึ้น GitHub (https://github.com/Imadicatu/ridechekv2.git) แบบ Real-time อัตโนมัติ 100%
 * 
 * คุณสมบัติ:
 * 1. Debounce Mechanism: รอ 4 วินาทีหลังเซฟไฟล์เพื่อรวมการเปลี่ยนแปลงหลายไฟล์เป็น 1 Commit
 * 2. Auto-Rebase Protection: ดึงอัปเดตล่าสุดจาก GitHub Actions (bot-runner) ป้องกัน Push Rejected
 * 3. Ignore Rules: ข้าม node_modules, .git, และ credential สำคัญ (.env, serviceAccountKey.json)
 * 4. Dual-Mode: รองรับทั้งโหมด Watcher ต่อเนื่อง (--watch) และรันครั้งเดียวจบ (--once)
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const ROOT_DIR = __dirname;
const args = process.argv.slice(2);
const isOnce = args.includes('--once') || args.includes('-o');

// ไฟล์และโฟลเดอร์ที่ไม่ต้องดักจับเพื่อป้องกัน Infinite Push Loop
const IGNORED_PATTERNS = [
    /\.git/,
    /node_modules/,
    /\.env/,
    /serviceAccountKey\.json/,
    /logs[\\\/]/,
    /\.log$/,
    /\.tmp$/,
    /~$/
];

let changedFiles = new Set();
let debounceTimer = null;
let isSyncing = false;

function shouldIgnore(filePath) {
    const relPath = path.relative(ROOT_DIR, filePath);
    return IGNORED_PATTERNS.some(pattern => pattern.test(relPath));
}

function getFormattedTimestamp() {
    const now = new Date();
    return now.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function execCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
            if (error) {
                resolve({ ok: false, error: error.message, stderr, stdout });
            } else {
                resolve({ ok: true, stdout, stderr });
            }
        });
    });
}

async function performGitSync(reason = '') {
    if (isSyncing) {
        console.log('⏳ [Git-Sync] กำลังดำเนินการซิงก์อยู่ โปรดรอสักครู่...');
        return;
    }

    isSyncing = true;
    const timestamp = getFormattedTimestamp();
    console.log(`\n====================================================================`);
    console.log(`🚀 [Git-Sync] เริ่มต้นกระบวนการ Auto-Deploy ไปยัง GitHub ณ ${timestamp}`);
    if (reason) console.log(`📝 เหตุผล: ${reason}`);

    try {
        // 1. ตรวจสอบสถานะการเปลี่ยนแปลงใน Git
        const statusRes = await execCommand('git status --porcelain');
        if (!statusRes.ok) {
            console.error('❌ [Git-Sync Error] ไม่สามารถอ่านสถานะ git:', statusRes.error);
            isSyncing = false;
            return;
        }

        const changes = statusRes.stdout.trim();
        if (!changes && !isOnce) {
            console.log('ℹ️ [Git-Sync] โค้ดทั้งหมดเป็นเวอร์ชันล่าสุดแล้ว ไม่มีการเปลี่ยนแปลงใหม่');
            isSyncing = false;
            return;
        }

        // 2. ดึงการอัปเดตล่าสุดจาก GitHub ก่อน (ป้องกัน conflict กับ bot-runner.yml)
        console.log('📥 [1/4] ตรวจสอบและดึงการอัปเดตล่าสุดจาก GitHub (git pull --rebase)...');
        const pullRes = await execCommand('git pull --rebase origin main');
        if (!pullRes.ok) {
            console.warn('⚠️ [Git-Sync Warning] ไม่สามารถ pull ได้ กำลังดำเนินการต่อ:', pullRes.stderr || pullRes.error);
        }

        // 3. Stage ไฟล์ที่เปลี่ยนแปลงทั้งหมด
        console.log('📦 [2/4] กำลังจัดเตรียมไฟล์ (git add .)...');
        await execCommand('git add -A');

        // 4. Commit ไฟล์
        const fileListSummary = Array.from(changedFiles).slice(0, 3).map(f => path.basename(f)).join(', ');
        const commitMsg = fileListSummary 
            ? `⚡ [Auto-Sync] Update ${fileListSummary}${changedFiles.size > 3 ? ` (+${changedFiles.size - 3} files)` : ''} (${timestamp})`
            : `⚡ [Auto-Deploy] Sync Project Updates (${timestamp})`;

        console.log(`💾 [3/4] กำลังบันทึก Commit: "${commitMsg}"...`);
        const commitRes = await execCommand(`git commit -m "${commitMsg}"`);
        if (!commitRes.ok && !commitRes.stdout.includes('nothing to commit')) {
            console.log('ℹ️ [Git-Sync] ไม่มีรายการที่ต้อง commit ใหม่');
        }

        // 5. Push ขึ้น GitHub origin main
        console.log('🌐 [4/4] กำลัง Push ขึ้น GitHub repository (origin main)...');
        const pushRes = await execCommand('git push origin main');
        if (pushRes.ok) {
            console.log(`✅ [Git-Sync สำเร็จ 100%] โค้ดล่าสุดถูกส่งไปยัง GitHub เรียบร้อยแล้ว!`);
            console.log(`🔗 คลัง GitHub: https://github.com/Imadicatu/ridechekv2`);
        } else {
            console.error(`❌ [Git-Sync Push Failed]:`, pushRes.stderr || pushRes.error);
            console.log('💡 เคล็ดลับ: ลองตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือสิทธิ์การเข้าถึง GitHub');
        }
    } catch (err) {
        console.error('❌ [Git-Sync Exception]:', err.message);
    } finally {
        changedFiles.clear();
        isSyncing = false;
        console.log(`====================================================================\n`);
    }
}

function scheduleSync(filePath) {
    if (shouldIgnore(filePath)) return;

    changedFiles.add(filePath);
    const rel = path.relative(ROOT_DIR, filePath);
    console.log(`🔔 [File Saved] ตรวจพบการบันทึก: ${rel} (เตรียมส่งขึ้น GitHub ใน 4 วิ...)`);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        performGitSync(`บันทึกไฟล์ล่าสุด: ${Array.from(changedFiles).map(f => path.basename(f)).join(', ')}`);
    }, 4000); // ดีเลย์ 4 วินาทีเพื่อรอการเซฟหลายไฟล์พร้อมกัน
}

// โหมดรันครั้งเดียวจบ (--once)
if (isOnce) {
    performGitSync('สั่ง Deploy ทันทีผ่านคำสั่ง CLI (--once)').then(() => {
        process.exit(0);
    });
} else {
    // โหมดเฝ้าตรวจจับไฟล์อัตโนมัติ 24/7 (--watch)
    console.log('====================================================================');
    console.log('👀 [RideCheck Git-Sync Watcher เริ่มทำงาน]');
    console.log('📁 โฟลเดอร์ที่เฝ้าตรวจจับ: ' + ROOT_DIR);
    console.log('⚡ การทำงาน: เมื่อใดที่มีการกด Save ไฟล์ในโปรเจกต์');
    console.log('   ระบบจะทำ Git Add + Commit + Push ขึ้น GitHub ให้คุณอัตโนมัติ 100%');
    console.log('====================================================================\n');

    // ดักจับไฟล์ใน root directory และโฟลเดอร์ย่อย
    try {
        fs.watch(ROOT_DIR, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            const fullPath = path.join(ROOT_DIR, filename);
            scheduleSync(fullPath);
        });
    } catch (err) {
        console.error('❌ ไม่สามารถเปิด file watcher แบบ recursive ได้:', err.message);
    }
}

module.exports = { performGitSync };
