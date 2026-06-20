@echo off
@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup batch script
@REM ----------------------------------------------------------------------------
@IF "%__MVNW_ARG0_NAME__%"=="" (SET __MVNW_ARG0_NAME__=%~nx0)

@SET MAVEN_PROJECTBASEDIR=%~dp0
@IF NOT "%MAVEN_PROJECTBASEDIR:~-1%"=="\" (SET MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR%\)

@REM basedir senza backslash finale: serve a -Dmaven.multiModuleProjectDirectory,
@REM perché un "\" prima della virgoletta di chiusura romperebbe il quoting dell'argomento.
@SET "MVNW_BASEDIR_NOSLASH=%MAVEN_PROJECTBASEDIR:~0,-1%"

@SET WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar"
@SET WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
@SET DOWNLOAD_URL=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar

@FOR /F "usebackq tokens=1,2 delims==" %%A IN ("%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties") DO (
    @IF "%%A"=="wrapperUrl" SET DOWNLOAD_URL=%%B
)

@IF EXIST %WRAPPER_JAR% (
    @SET MVNW_REPOURL=
) ELSE (
    @ECHO Downloading Maven Wrapper...
    @powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile %WRAPPER_JAR%"
)

@SET JAVA_EXE=java.exe
@"%JAVA_EXE%" "-Dmaven.multiModuleProjectDirectory=%MVNW_BASEDIR_NOSLASH%" -cp %WRAPPER_JAR% %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*
