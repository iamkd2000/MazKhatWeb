@echo off
echo ========================================
echo OkCredit Clone - APK Builder
echo ========================================
echo.

cd /d "%~dp0"

echo Checking if you're logged in to Expo...
call npx eas whoami

echo.
echo Starting APK build...
echo This will take 10-15 minutes.
echo You'll get a download link when done.
echo.

call npx eas build -p android --profile preview

echo.
echo ========================================
echo Build Complete!
echo Check above for download link
echo ========================================
pause
