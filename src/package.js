import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let packageJson;
try {
  const packagePath = join(__dirname, '..', 'package.json');
  const packageData = readFileSync(packagePath, 'utf8');
  packageJson = JSON.parse(packageData);
} catch (error) {
  console.error('Error reading package.json:', error);
  packageJson = { version: 'unknown' };
}

export const version = packageJson.version;
export const name = packageJson.name;
export const description = packageJson.description;
export default packageJson; 