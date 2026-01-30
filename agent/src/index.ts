import { Command } from 'commander';
import inquirer from 'inquirer';
import Conf from 'conf';
import execa from 'execa';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const program = new Command();
const config = new Conf({ projectName: 'edu-agent' });

// Default configuration - In production this would point to the real Nexus
const DEFAULT_NEXUS_URL = 'http://localhost:3002'; 
const DOCKER_IMAGE = 'ghcr.io/educacioncooperativa/worker:latest';

const getConfigString = (key: string): string => {
  const value = config.get(key);
  return typeof value === 'string' ? value : '';
};

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
        message: 'Path to serviceAccountKey.json (optional, for File Sync):',
        validate: (input: string) => input.length === 0 || fs.existsSync(input) ? true : 'File not found',
      },
      {
        type: 'input',
        name: 'firebaseBucket',
        message: 'Firebase Storage bucket (optional):',
        default: config.get('firebaseBucket', ''),
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
    config.set('serviceAccountPath', answers.serviceAccountPath ? path.resolve(answers.serviceAccountPath) : '');
    config.set('mountPath', answers.mountPath);
    config.set('firebaseBucket', answers.firebaseBucket);

    console.log(chalk.green('✅ Configuration saved successfully!'));
  });

program
  .command('start')
  .description('Start the assistant in a Docker container')
  .option('-d, --daemon', 'Run in background', false)
  .action(async (options) => {
    const token = getConfigString('token');
    const nexusUrl = getConfigString('nexusUrl');
    const mountPath = getConfigString('mountPath');
    const serviceAccountPath = getConfigString('serviceAccountPath');
    const firebaseBucket = getConfigString('firebaseBucket');

    if (!token || !nexusUrl) {
      console.log(chalk.red('❌ Agent not configured. Please run "edu-agent setup" first.'));
      return;
    }
    if (!mountPath) {
      console.log(chalk.red('❌ Mount path missing. Please run "edu-agent setup" again.'));
      return;
    }
    if (!fs.existsSync(mountPath)) {
      fs.mkdirSync(mountPath, { recursive: true });
    }

    // Check for Docker
    try {
      await execa('docker', ['--version']);
    } catch (e) {
      console.log(chalk.red('❌ Docker is not installed or not running. Please install Docker first.'));
      return;
    }

    console.log(chalk.yellow(`🚀 Starting Agent Container with Sync...`));

    const dockerArgs: string[] = [
      'run',
      options.daemon ? '-d' : '-it',
    ];

    if (options.daemon) {
      dockerArgs.push('--restart=always');
    } else {
      dockerArgs.push('--rm');
    }

    dockerArgs.push(
      '--name=edu-worker',
      '--network=host',
      '-e', `NEXUS_URL=${nexusUrl}`,
      '-e', `WORKER_TOKEN=${token}`,
      '-e', `WORKER_NAME=${process.env.USER || 'local-user'}`,
      '-v', `${mountPath}:/workspace`
    );

    if (firebaseBucket) {
      dockerArgs.push('-e', `FIREBASE_BUCKET=${firebaseBucket}`);
    }

    if (serviceAccountPath) {
      if (fs.existsSync(serviceAccountPath)) {
        dockerArgs.push('-v', `${serviceAccountPath}:/app/serviceAccountKey.json:ro`);
      } else {
        console.log(chalk.yellow('⚠️  serviceAccountKey.json not found. Sync disabled.'));
      }
    }

    dockerArgs.push(DOCKER_IMAGE);

    try {
      // Remove existing container if exists
      try {
        await execa('docker', ['rm', '-f', 'edu-worker']);
      } catch (err) {
        void err;
      }

      if (options.daemon) {
        await execa('docker', dockerArgs);
        console.log(chalk.green('✅ Agent is running in the background!'));
      } else {
        // Run interactive/attached
        const subprocess = execa('docker', dockerArgs, { stdio: 'inherit' });
        await subprocess;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(chalk.red('Failed to start Docker container:'), message);
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
