#!/bin/bash
set -euo pipefail
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
RG=myprivateteacher-turn
LOC=southcentralus
echo "== subscription: $(az account show --query name -o tsv)"
echo '== resource group'
az group create -n $RG -l $LOC --tags app=myprivateteacher purpose=turn -o none
echo '== network security group (TURN ports only, no SSH)'
az network nsg create -g $RG -n turn-nsg --tags app=myprivateteacher -o none
az network nsg rule create -g $RG --nsg-name turn-nsg -n turn-udp --priority 100 --direction Inbound --access Allow --protocol Udp --destination-port-ranges 3478 49152-49252 -o none
az network nsg rule create -g $RG --nsg-name turn-nsg -n turn-tcp --priority 110 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 3478 443 -o none
az network nsg rule create -g $RG --nsg-name turn-nsg -n cert-renewal --priority 120 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 80 -o none
echo '== static public IP with a free Azure hostname'
az network public-ip create -g $RG -n turn-ip --sku Standard --allocation-method Static --version IPv4 --dns-name myprivateteacher-turn --tags app=myprivateteacher -o none
echo '== VM: B1ls, Ubuntu 24.04, standard HDD'
rm -f /tmp/mpt_turn_key /tmp/mpt_turn_key.pub
ssh-keygen -q -t rsa -b 3072 -N '' -f /tmp/mpt_turn_key
az vm create -g $RG -n turn --image Ubuntu2404 --size Standard_B1ls --storage-sku Standard_LRS --os-disk-size-gb 30 --admin-username turnadmin --ssh-key-values /tmp/mpt_turn_key.pub --public-ip-address turn-ip --nsg turn-nsg --nsg-rule NONE --tags app=myprivateteacher purpose=turn -o none
rm -f /tmp/mpt_turn_key /tmp/mpt_turn_key.pub
echo '== result'
az network public-ip show -g $RG -n turn-ip --query '[ipAddress, dnsSettings.fqdn]' -o tsv
az vm show -d -g $RG -n turn --query '[powerState, privateIps, hardwareProfile.vmSize]' -o tsv
echo DONE
