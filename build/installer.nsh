!include "LogicLib.nsh"

Function .onVerifyInstDir
  StrLen $0 $INSTDIR
  ${If} $0 == 2
    StrCpy $INSTDIR "$INSTDIR\LX-WMS"
  ${ElseIf} $0 == 3
    StrCpy $1 $INSTDIR 2 -2
    ${If} $1 == ":\\"
      StrCpy $INSTDIR "$INSTDIRLX-WMS"
    ${EndIf}
  ${EndIf}
FunctionEnd

!macro customUnInstall
  RMDir /r "$APPDATA\\LX-WMS"
  RMDir /r "$LOCALAPPDATA\\LX-WMS"
  RMDir /r "$APPDATA\\lx-wms"
  RMDir /r "$LOCALAPPDATA\\lx-wms"
!macroend
