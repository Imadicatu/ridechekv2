@echo off
chcp 65001 >nul
title RideCheck - Auto Git Sync & GitHub Deploy Watcher
cd /d "%~dp0"
echo ====================================================================
echo  🚀 RideCheck Thailand - Real-Time GitHub Auto-Sync Engine
echo ====================================================================
echo  ทุกครั้งที่มีการ Save หรือแก้ไขไฟล์ในโปรเจกต์ (เช่น index.html)
echo  ระบบจะตรวจจับและทำการ Push ขึ้น GitHub ให้อัตโนมัติทันที 100%%
echo  (คลังโปรเจกต์: https://github.com/Imadicatu/ridechekv2)
echo ====================================================================
echo.
node git-sync-watcher.js --watch
pause
