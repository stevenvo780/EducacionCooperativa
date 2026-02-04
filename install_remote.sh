#!/bin/bash
echo 'REDACTED_PASSWORD' | sudo -S dpkg -i /tmp/edu-hub_1.0.2_amd64.deb
echo 'REDACTED_PASSWORD' | sudo -S systemctl restart edu-hub
