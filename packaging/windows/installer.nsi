Unicode true
!include 'MUI2.nsh'
!ifndef VERSION
!define VERSION '0.9.0-beta'
!endif
Name 'ANATHEOS ${VERSION}'
OutFile '..\..\dist\ANATHEOS-Setup-${VERSION}.exe'
InstallDir '$LOCALAPPDATA\Programs\ANATHEOS'
RequestExecutionLevel user
SetCompressor lzma
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE 'Spanish'
Function .onInit
  System::Call 'kernel32::OpenMutexW(i 0x100000, i 0, w "Local\ANATHEOS") p.r0'
  ${If} $0 != 0
    System::Call 'kernel32::CloseHandle(p r0)'
    MessageBox MB_ICONSTOP 'Cerrá ANATHEOS antes de instalar o actualizar.'
    Abort
  ${EndIf}
FunctionEnd
Function un.onInit
  System::Call 'kernel32::OpenMutexW(i 0x100000, i 0, w "Local\ANATHEOS") p.r0'
  ${If} $0 != 0
    System::Call 'kernel32::CloseHandle(p r0)'
    MessageBox MB_ICONSTOP 'Cerrá ANATHEOS antes de desinstalar.'
    Abort
  ${EndIf}
FunctionEnd
Section
  SetShellVarContext current
  SetOutPath '$INSTDIR\versions\${VERSION}'
  File /r '..\..\dist\ANATHEOS\*'
  ExecWait '"$INSTDIR\versions\${VERSION}\ANATHEOS.exe" --self-test' $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP 'La nueva versión no pasó su comprobación. La versión anterior permanece disponible.'
    SetErrorLevel 1
    Quit
  ${EndIf}
  ReadRegStr $1 HKCU 'Software\ANATHEOS' 'CurrentVersion'
  WriteRegStr HKCU 'Software\ANATHEOS' 'PreviousVersion' '$1'
  WriteRegStr HKCU 'Software\ANATHEOS' 'CurrentVersion' '${VERSION}'
  CreateDirectory '$SMPROGRAMS\ANATHEOS'
  ${If} $1 != ''
    CreateShortcut '$SMPROGRAMS\ANATHEOS\Recuperar version anterior.lnk' '$INSTDIR\versions\$1\ANATHEOS.exe'
  ${EndIf}
  CreateShortcut '$SMPROGRAMS\ANATHEOS\ANATHEOS.lnk' '$INSTDIR\versions\${VERSION}\ANATHEOS.exe'
  CreateShortcut '$DESKTOP\ANATHEOS.lnk' '$INSTDIR\versions\${VERSION}\ANATHEOS.exe'
  WriteUninstaller '$INSTDIR\Uninstall.exe'
  WriteRegStr HKCU 'Software\Microsoft\Windows\CurrentVersion\Uninstall\ANATHEOS' 'DisplayName' 'ANATHEOS'
  WriteRegStr HKCU 'Software\Microsoft\Windows\CurrentVersion\Uninstall\ANATHEOS' 'DisplayVersion' '${VERSION}'
  WriteRegStr HKCU 'Software\Microsoft\Windows\CurrentVersion\Uninstall\ANATHEOS' 'UninstallString' '"$INSTDIR\Uninstall.exe"'
SectionEnd
Section 'Uninstall'
  SetShellVarContext current
  Delete '$DESKTOP\ANATHEOS.lnk'
  RMDir /r '$SMPROGRAMS\ANATHEOS'
  RMDir /r '$INSTDIR\versions'
  Delete '$INSTDIR\Uninstall.exe'
  RMDir '$INSTDIR'
  DeleteRegKey HKCU 'Software\ANATHEOS'
  DeleteRegKey HKCU 'Software\Microsoft\Windows\CurrentVersion\Uninstall\ANATHEOS'
SectionEnd
