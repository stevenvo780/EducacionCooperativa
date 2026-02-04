#!/bin/bash
PASS='REDACTED_PASSWORD'
echo "$PASS" | sudo -S dpkg -i /tmp/edu-hub_1.0.1_amd64.deb
echo "$PASS" | sudo -S systemctl restart edu-hub
