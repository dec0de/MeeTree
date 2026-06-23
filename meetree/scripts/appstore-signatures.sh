#!/usr/bin/env sh
set -eu

APP_ID="meetree"
KEY_PATH="${1:-${HOME}/.nextcloud/certificates/${APP_ID}.key}"
CERT_PATH="meetree/appinfo/certificate.crt"
VERSION="$(grep -m1 '<version>' "${APP_ID}/appinfo/info.xml" | sed -E 's/.*<version>([^<]+)<\/version>.*/\1/')"
ARCHIVE="build/${APP_ID}-${VERSION}.tar.gz"
SIGNATURE="${ARCHIVE}.sig"

if [ ! -f "${KEY_PATH}" ]; then
  printf '%s\n' "Private key not found: ${KEY_PATH}" >&2
  printf '%s\n' "Usage: ${0} [/path/to/${APP_ID}.key]" >&2
  exit 1
fi

if [ ! -f "${CERT_PATH}" ]; then
  printf '%s\n' "Public certificate not found: ${CERT_PATH}" >&2
  exit 1
fi

if [ ! -f "${ARCHIVE}" ]; then
  sh "${APP_ID}/scripts/package-release.sh"
fi

printf '%s\n' "App Store registration signature for app id '${APP_ID}':"
printf '%s' "${APP_ID}" | openssl dgst -sha512 -sign "${KEY_PATH}" | openssl base64 -A
printf '\n\n'

openssl dgst -sha512 -sign "${KEY_PATH}" "${ARCHIVE}" | openssl base64 -A > "${SIGNATURE}"

printf '%s\n' "Release archive: ${ARCHIVE}"
printf '%s\n' "Release signature file: ${SIGNATURE}"
printf '%s\n' "Release signature:"
cat "${SIGNATURE}"
printf '\n'
