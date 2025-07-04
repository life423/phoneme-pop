@echo off
echo Setting up Azure service principal and GitHub secrets...

REM Load environment variables
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="DOCKER_USER" set DOCKER_USER=%%b
    if "%%a"=="DOCKER_TOKEN" set DOCKER_TOKEN=%%b
)

REM Set variables
set APP_NAME=phoneme-pop
set RESOURCE_GROUP=portfolio-apps
set GITHUB_REPO=aiandrew631/phoneme-pop

echo Creating service principal...
az ad sp create-for-rbac --name %APP_NAME%-sp --role contributor --scopes /subscriptions/$(az account show --query id -o tsv) --sdk-auth > sp-output.json

echo Getting service principal details...
for /f "tokens=*" %%i in ('powershell -command "(Get-Content sp-output.json | ConvertFrom-Json).clientId"') do set CLIENT_ID=%%i
for /f "tokens=*" %%i in ('powershell -command "(Get-Content sp-output.json | ConvertFrom-Json).tenantId"') do set TENANT_ID=%%i
for /f "tokens=*" %%i in ('az account show --query id -o tsv') do set SUBSCRIPTION_ID=%%i

echo Setting GitHub secrets...
gh secret set PHONEMEPOP_AZURE_CLIENT_ID --body "%CLIENT_ID%" --repo %GITHUB_REPO%
gh secret set PHONEMEPOP_AZURE_TENANT_ID --body "%TENANT_ID%" --repo %GITHUB_REPO%
gh secret set PHONEMEPOP_AZURE_SUBSCRIPTION_ID --body "%SUBSCRIPTION_ID%" --repo %GITHUB_REPO%
gh secret set PHONEMEPOP_REGISTRY_USERNAME --body "%DOCKER_USER%" --repo %GITHUB_REPO%
gh secret set PHONEMEPOP_REGISTRY_PASSWORD --body "%DOCKER_TOKEN%" --repo %GITHUB_REPO%

echo Cleaning up...
del sp-output.json

echo Setup complete! GitHub secrets have been configured.
pause