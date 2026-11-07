# ALTIVE DEV — APK Android (prévia de homologação)

This is an **Android WebView client** to open the hosted ALTIVE DEV license activation UI at HTTPS URL `/extension`. It is NOT the Chrome/Edge MV3 extension from the v0.3 ZIP.

## What the APK can do
- Open license activation page, access project queue after a valid license, keep HTTPS session cookies, navigate the hosted ALTIVE DEV pages.
- No Termux or separate local Node server required.
- No embedded API keys or GitHub personal access tokens.

## NOT yet supported in APK
- Native GitHub commits or AI editing from the Chrome desktop extension.
- ChatGPT / Gemini account login; user-owned provider API keys remain a separate integration.
- Production-ready licensing: migration `20261107170000_altiv_extension_license_access.sql` and staging QA are still required. This APK alone will not enable code activation.

## Build (Android CI)
A GitHub Actions PR workflow uses JDK 17, Android SDK 35 and Gradle 8.10.2 / Android Gradle plugin 8.7.3:
`gradle :app:assembleDebug`
Artifact: `app/build/outputs/apk/debug/app-debug.apk`.

The default home URL is `https://altiv-dev-web.vercel.app/extension`, based on the web app's repository configuration. **Confirm the correct live domain before commercial deployment**. Override when building with:
`gradle :app:assembleDebug -PaltivePortalUrl=https://YOUR-HOST/extension`

The DEBUG build uses a CI-created debug signing key (not stable between runs); it should only be installed for testing and may need uninstall before installing another debug APK. For updates without losing app data, configure a secure permanent release signing key via protected CI secrets; never commit keystores.

This code intentionally restricts embedded browsing to a single HTTPS host; external HTTPS links open in the system browser. It disallows cleartext, file access, and SSL-error bypass.

## Test checklist
- Real URL exists, renders on Chrome and Android WebView
- Login, activation, reentry and logout
- Suspended/revoked/expired license
- Offline UI
- External link handling and security
- Android 8+ phone
- Preserve sessions using permanent signing identity for release
