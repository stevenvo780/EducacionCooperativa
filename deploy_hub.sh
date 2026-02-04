#!/bin/bash
PASS='zxcvFDSA90%acD'
echo "$PASS" | sudo -S dpkg -i /tmp/edu-hub_1.0.1_amd64.deb
echo "$PASS" | sudo -S systemctl restart edu-hub
