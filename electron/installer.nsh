!macro customInit
  StrCpy $R0 "0"

  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.dtr-template.app" "UninstallString"
  ${If} $0 != ""
    StrCpy $R0 "1"
  ${EndIf}

  ${If} $R0 == "0"
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.dtr-template.app" "UninstallString"
    ${If} $0 != ""
      StrCpy $R0 "1"
    ${EndIf}
  ${EndIf}

  ${If} $R0 == "0"
    ReadRegStr $0 HKCU "Software\com.dtr-template.app" "InstallLocation"
    ${If} $0 != ""
      StrCpy $R0 "1"
    ${EndIf}
  ${EndIf}

  ${If} $R0 == "0"
    MessageBox MB_OK|MB_ICONSTOP "DTR Template is not currently installed on this system.$\r$\n$\r$\nThis installer is an update only and requires an existing installation."
    Abort
  ${EndIf}
!macroend

