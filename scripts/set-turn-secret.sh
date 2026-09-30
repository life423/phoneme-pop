#!/bin/bash
# Creates the shared TURN secret and installs it on both sides: the relay VM (coturn)
# and the Container App, which uses it to sign a short-lived TURN login for each call.
# The secret is never printed or saved anywhere else. Run it again any time to rotate it.
set -euo pipefail
RELAY_RG=myprivateteacher-turn
APP_RG=portfolio-apps
APP=phoneme-pop

HOST=$(az network public-ip show -g "$RELAY_RG" -n turn-ip --query dnsSettings.fqdn -o tsv)
SECRET=$(openssl rand -hex 32)

echo "1/2 Installing it on the relay ($HOST)..."
az vm run-command create -g "$RELAY_RG" --vm-name turn --name set-turn-secret --script 'sed -i "s|^static-auth-secret=.*|static-auth-secret=${TURN_SECRET}|" /etc/turnserver.conf && systemctl restart coturn && echo "coturn $(systemctl is-active coturn)"' --protected-parameters TURN_SECRET="$SECRET" --async-execution false --timeout-in-seconds 120 -o none
az vm run-command show -g "$RELAY_RG" --vm-name turn --name set-turn-secret --instance-view --query instanceView.output -o tsv
az vm run-command delete -g "$RELAY_RG" --vm-name turn --name set-turn-secret --yes -o none

echo "2/2 Installing it on the app ($APP); it restarts once..."
az containerapp secret set -n "$APP" -g "$APP_RG" --secrets turn-secret="$SECRET" -o none
az containerapp update -n "$APP" -g "$APP_RG" --set-env-vars TURN_SECRET=secretref:turn-secret TURN_HOST="$HOST" TURN_TLS=true -o none

unset SECRET
echo 'Done: the relay and the app share a new TURN secret (not shown, not saved anywhere else).'
