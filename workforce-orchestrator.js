/**
 * ==============================================================================
 * RideCheck Autonomous AI Workforce — Master Orchestrator (100% Full-Efficiency)
 * ==============================================================================
 * สั่งการและบริหาร 3 เสาหลักของ RideCheck ให้ทำงานพร้อมกัน 100% ไม่มีสะดุด:
 * 1. Web & Proxy Server (server.js) — พอร์ต 3000 พร้อม API ควบคุม AI
 * 2. Autonomous Workforce Engine (worker-engine.js) — วนรอบขับเคลื่อน 14 แผนกอัตโนมัติ
 * 3. Baron Secretary Telegram AI Bot (telegram-baron.js) — เลขานุการรับคำสั่งสด
 * ==============================================================================
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = __dirname;

console.log('====================================================================');
console.log('🏛️  [RideCheck Master Autonomous AI Orchestrator 100%]');
console.log('👑 นำทัพโดย: ท่าน Siridetxh (ประธานกรรมการบริหารสูงสุด / CEO & President)');
console.log('🤖 ขับเคลื่อน: 14 AI Departments • Web Server • Telegram Baron Bot');
console.log('====================================================================\n');

function startProcess(name, scriptFile, args = []) {
    const proc = spawn('node', [path.join(ROOT_DIR, scriptFile), ...args], {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });

    proc.on('close', (code) => {
        console.log(`⚠️ [${name}] ออกจากกระบวนการด้วยโค้ด (${code}) กำลังรีสตาร์ตใหม่อัตโนมัติใน 3 วินาที...`);
        setTimeout(() => startProcess(name, scriptFile, args), 3000);
    });

    proc.on('error', (err) => {
        console.error(`❌ [${name}] เกิดข้อผิดพลาด:`, err.message);
    });

    return proc;
}

// 1. เริ่มเว็บเซิร์ฟเวอร์หลัก (พอร์ต 3000 + AI APIs)
console.log('🌐 [1/3] กำลังเริ่ม Web Server (server.js)...');
startProcess('WebServer', 'server.js');

// 2. เริ่มวงรอบ Autonomous AI Workforce (วนรอบอัตโนมัติทุก 15 นาที พร้อมรันรอบแรกทันที)
console.log('🤖 [2/3] กำลังเริ่ม AI Workforce Engine 14 แผนก (worker-engine.js)...');
startProcess('AIWorkforce', 'worker-engine.js', ['--interval=15']);

// 3. เริ่ม Telegram Baron Secretary Bot
console.log('🎩 [3/4] กำลังเริ่ม Telegram Baron Bot (telegram-baron.js)...');
startProcess('BaronBot', 'telegram-baron.js');

// 4. เริ่ม Git Auto-Deploy Watcher (ตรวจจับการ Save โค้ดแล้ว Push อัตโนมัติ)
console.log('⚡ [4/4] กำลังเริ่ม Git Auto-Deploy Watcher (git-sync-watcher.js)...');
startProcess('GitSync', 'git-sync-watcher.js', ['--watch']);

console.log('\n✨ ระบบทั้งหมด (Web + 14 AI Departments + Telegram Baron + Git Auto-Deploy) กำลังทำงานร่วมกันเต็มประสิทธิภาพ 100% (กด Ctrl+C เพื่อหยุด)');
