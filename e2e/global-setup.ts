import { execSync } from 'node:child_process';

// Reset to a known dataset so assertions on counts/subjects are stable.
export default function globalSetup() {
  execSync('npm run seed', { stdio: 'inherit' });
}
