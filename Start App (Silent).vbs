' ===================================================
' Silent launcher: kills any previous instance first,
' then runs backend + frontend hidden in the background.
' The browser is opened automatically by Vite itself
' (server.open: true in vite.config.js) - not by this script.
' ===================================================

Dim fso, shell, scriptFolder
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = scriptFolder

' Kill any node processes left over from a previous run (waits for it to finish: True)
On Error Resume Next
shell.Run "cmd /c taskkill /F /IM node.exe /T", 0, True
On Error Goto 0

' Small pause to let the OS fully release the ports
WScript.Sleep 1500

' Run "npm run start-all" completely hidden (0 = hidden window, False = don't wait)
' Vite will open the browser tab itself once ready - nothing else to do here.
shell.Run "cmd /c npm run start-all", 0, False