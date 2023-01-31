import { resolve } from 'path';
import dotenv from 'dotenv';

const envFilePath = resolve(process.cwd(), '.env');
dotenv.config({ path: envFilePath });

export const checkEnvVariables = (vars: string[]): void =>
  vars.forEach((variable) => {
    if (!process.env[variable] || process.env[variable] === '') {
      throw new Error(`${variable} must be provided in the .env`);
    }
  });

checkEnvVariables([]);

export const NODE_ENV = process.env.NODE_ENV || '';

export const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
