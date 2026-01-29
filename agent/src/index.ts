import { Command } from 'commander';
import inquirer from 'inquirer';
import Conf from 'conf';
import execa from 'execa';
import chalk from 'chalk';
import fs from 'fs';
import os from 'os';
import path from 'path';

const program = new Command();
const config = new Conf({ projectName: 'edu-agent' });

// Default configuration - In production this would point to the real Nexus
const DEFAULT_NEXUS_URL = 'http://localhost:3002'; 
const DOCKER_IMAGE = 'ghcr.io/educacioncooperativa/worker:latest';

program
  .name('edu-agent')
  .description('Education Cooperative Local Agent Manager')
  .version('1.0.0');

program
  .command('setup')
  .description('Configure the agent with your user credentials')
  .action(async () => {
    console.log(chalk.blue('👋 Welcome to the Education Cooperative Agent Setup'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'nexusUrl',
        message: 'Nexus Server URL:',
        default: config.get('nexusUrl', DEFAULT_NEXUS_URL),
      },
      {
        type: 'password',
        name: 'token',
        message: 'Paste your Worker Token (User UID):',
        validate: (input: string) => input.length > 0 ? true : 'Token is required',
      },
      {
        type: 'input',
        name: 'serviceAccountPath',
        message: 'Path to serviceAccountKey.json (for File Sync):',
        validate: (input: string) => fs.existsSync(input) ? true : 'File not found',
      },
      {
        type: 'input',
        name: 'mountPath',
        message: 'Local directory to expose to the assistant:',
        default: process.cwd(),
      }
    ]);

    config.set('nexusUrl', answers.nexusUrl);
    config.set('token', answers.token);
    config.set('serviceAccountPath', path.resolve(answers.serviceAccountPath));
    config.set('mountPath', answers.mountPath);

    console.log(chalk.green('✅ Configuration saved successfully!'));
  });

program
  .command('start')
  .description('Start the assistant in a Docker container')
  .option('-d, --daemon', 'Run in background', false)
  .action(async (options) => {
    const token = config.get('token');
    const nexusUrl = config.get('nexusUrl');
    const mountPath = config.get('mountPath');
    const serviceAccountPath = config.get('serviceAccountPath');

    if (!token || !nexusUrl || !serviceAccountPath) {
      console.log(chalk.red('❌ Agent not configured. Please run "edu-agent setup" first.'));
      return;
    }

    // Check for Docker
    try {
      await execa('docker', ['--version']);
    } catch (e) {
      console.log(chalk.red('❌ Docker is not installed or not running. Please install Docker first.'));
      return;
    }

    console.log(chalk.yellow(`🚀 Starting Agent Container with Sync...`));

    // We need to inject the sync script. In a real deb, these would be in /usr/share/edu-agent/
    // For now, we assume they are relative to this script or we download them/write them.
    // Let's assume the agent package includes them in dist/sync-service.
    
    // Construct the entrypoint script dynamically
    const entrypointScript = `#!/bin/bash
# Install dependencies for sync
pip3 install watchdog firebase-admin > /dev/null 2>&1 &

# Start the Node Worker (Main Process) in background
node /app/worker/dist/index.js &

# Wait a bit for pip
sleep 5

# Start Sync Agent (Non-fatal, logged)
echo "Starting Sync Agent..."
python3 /app/sync_agent.py > /var/log/sync_agent.log 2>&1 &

# Wait for worker (Main process)
wait -n
`;
    
    // Write entrypoint and sync script to a temp dir to mount
    const tmpDir = path.join(os.homedir(), '.edu-agent-tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    fs.writeFileSync(path.join(tmpDir, 'entrypoint.sh'), entrypointScript, { mode: 0o755 });
    
    // Locate the sync agent script
    // Priority 1: Dev environment (relative)
    // Priority 2: Production (.deb install path)
    let syncSrc = path.join(__dirname, '../sync-service/sync_agent.py');
    if (!fs.existsSync(syncSrc)) {
        syncSrc = '/usr/lib/edu-agent/sync_agent.py';
    }

    if (fs.existsSync(syncSrc)) {
        fs.copyFileSync(syncSrc, path.join(tmpDir, 'sync_agent.py'));
    } else {
        console.warn(chalk.yellow('⚠️  Warning: Sync agent script not found. File sync might not work.'));
        // Create a dummy file to prevent docker crash
        fs.writeFileSync(path.join(tmpDir, 'sync_agent.py'), 'import time; while True: time.sleep(3600)');
    }

    const dockerArgs = [
      'run',
      options.daemon ? '-d' : '-it',
      '--restart=always',
      '--name=edu-worker',
      // Environment
      '-e', `NEXUS_URL=${nexusUrl}`,
      '-e', `WORKER_TOKEN=${token}`,
      '-e', `WORKER_NAME=${process.env.USER || 'local-user'}`,
      // Mounts
      '-v', `${mountPath}:/workspace`,
      '-v', `${serviceAccountPath}:/app/serviceAccountKey.json`,
      '-v', `${tmpDir}/entrypoint.sh:/entrypoint.sh`,
      '-v', `${tmpDir}/sync_agent.py:/app/sync_agent.py`,
      // Network
      '--network=host',
      // Entrypoint override
      '--entrypoint', '/entrypoint.sh',
      // Image
      DOCKER_IMAGE
    ];

    try {
      // Remove existing container if exists
      try { await execa('docker', ['rm', '-f', 'edu-worker']); } catch {}

      if (options.daemon) {
        await execa('docker', dockerArgs);
        console.log(chalk.green('✅ Agent is running in the background!'));
      } else {
        // Run interactive/attached
        const subprocess = execa('docker', dockerArgs, { stdio: 'inherit' });
        await subprocess;
      }
    } catch (e: any) {
      console.error(chalk.red('Failed to start Docker container:'), e.message);
    }
  });

program
  .command('stop')
  .description('Stop the agent')
  .action(async () => {
    try {
      await execa('docker', ['stop', 'edu-worker']);
      await execa('docker', ['rm', 'edu-worker']);
      console.log(chalk.green('🛑 Agent stopped.'));
    } catch (e) {
      console.log(chalk.yellow('Agent was not running.'));
    }
  });

program.parse(process.argv);
