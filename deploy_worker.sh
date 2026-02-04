#!/bin/bash
PASS='O7jXiVe9G84r'
echo "$PASS" | sudo -S dpkg -i --force-confnew /tmp/edu-worker_1.0.1_amd64.deb
echo "$PASS" | sudo -S edu-worker-manager restart all
