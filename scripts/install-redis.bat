@echo off
echo Installing Redis for Windows...

REM Create Redis directory
if not exist "C:\Redis" mkdir "C:\Redis"

echo Downloading Redis...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.zip' -OutFile 'C:\Redis\Redis.zip'"

echo Extracting Redis...
powershell -Command "Expand-Archive -Path 'C:\Redis\Redis.zip' -DestinationPath 'C:\Redis' -Force"

echo Starting Redis server...
start /B "Redis Server" "C:\Redis\redis-server.exe"

timeout /t 3 /nobreak >nul

echo Testing Redis connection...
"C:\Redis\redis-cli.exe" ping

echo.
echo Redis installation complete!
echo Redis is running on localhost:6379
echo.
echo Now restart your CRM server to see the performance improvements!
pause
