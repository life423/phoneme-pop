#!/bin/bash
# Runs on the TURN VM (via az vm run-command). Args: FQDN PUBLIC_IP PRIVATE_IP
set -e
FQDN=$1; PUBLIC_IP=$2; PRIVATE_IP=$3
export DEBIAN_FRONTEND=noninteractive
apt-get update -q >/dev/null
apt-get install -y -q coturn certbot >/dev/null
echo "installed: $(dpkg-query -W -f='${Package} ${Version}' coturn)"

# Let coturn bind port 443 as its unprivileged user.
mkdir -p /etc/systemd/system/coturn.service.d
cat > /etc/systemd/system/coturn.service.d/override.conf <<'CONF'
[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE
CONF
systemctl daemon-reload

# Free certificate so TURN also works over TLS on port 443 (strict school and office networks).
mkdir -p /etc/coturn /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/coturn.sh <<HOOK
#!/bin/sh
install -m 640 -o root -g turnserver /etc/letsencrypt/live/$FQDN/fullchain.pem /etc/coturn/cert.pem
install -m 640 -o root -g turnserver /etc/letsencrypt/live/$FQDN/privkey.pem /etc/coturn/key.pem
systemctl restart coturn
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/coturn.sh
TLS=no
if certbot certonly --standalone --non-interactive --agree-tos --register-unsafely-without-email -d "$FQDN" > /tmp/certbot.log 2>&1; then
  TLS=yes
  /etc/letsencrypt/renewal-hooks/deploy/coturn.sh || true
else
  echo 'certificate: failed, TLS on 443 skipped for now'; tail -2 /tmp/certbot.log
fi

# Keep an existing shared secret; otherwise a random placeholder until set-turn-secret.sh installs the real one.
SECRET=$(grep -s '^static-auth-secret=' /etc/turnserver.conf | cut -d= -f2- || true)
[ -n "$SECRET" ] || SECRET=$(openssl rand -hex 32)

cat > /etc/turnserver.conf <<CONF
# TURN/STUN relay for the myprivateteacher.com whiteboard video calls.
listening-port=3478
listening-ip=$PRIVATE_IP
relay-ip=$PRIVATE_IP
external-ip=$PUBLIC_IP/$PRIVATE_IP
min-port=49152
max-port=49252
realm=myprivateteacher.com
server-name=$FQDN
fingerprint
# Only short-lived logins signed by the app server.
use-auth-secret
static-auth-secret=$SECRET
no-cli
no-multicast-peers
no-tlsv1
no-tlsv1_1
stale-nonce=600
user-quota=12
total-quota=120
max-bps=3000000
syslog
# Never relay into private or special networks.
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=224.0.0.0-255.255.255.255
CONF
if [ "$TLS" = yes ]; then
cat >> /etc/turnserver.conf <<CONF
tls-listening-port=443
cert=/etc/coturn/cert.pem
pkey=/etc/coturn/key.pem
CONF
fi
chown root:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf
[ -f /etc/default/coturn ] && sed -i 's/^#*TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
systemctl enable coturn >/dev/null 2>&1
systemctl restart coturn
sleep 2
echo "coturn: $(systemctl is-active coturn) | tls on 443: $TLS | security updates: $(systemctl is-enabled unattended-upgrades 2>/dev/null)"
ss -lntup | grep turnserver | awk '{print $1, $5}' | sort -u
