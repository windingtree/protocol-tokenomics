import { resolve } from 'path';
import { BigNumber } from 'ethers';
import dotenv from 'dotenv';

const envFilePath = resolve(process.cwd(), '.env');
dotenv.config({ path: envFilePath });

export const checkEnvVariables = (vars: string[]): void =>
  vars.forEach((variable) => {
    if (!process.env[variable] || process.env[variable] === '') {
      throw new Error(`${variable} must be provided in the .env`);
    }
  });

checkEnvVariables([
  'MAINNET_ACCOUNTS_NUMBER',
  'MAINNET_DEFAULT_LIF',
  'MAINNET_DEFAULT_STABLE',
  'MAINNET_ACCOUNTS_ETH',
  'MAINNET_BASE_FEE',
  'DAO_FEE',
  'DAO_LIF',
  'INFLATION',
  'L3_BASE_FEE',
  'BRIDGE_LIF',
  'SUPPLIER_NUMBER',
  'SUPPLIER_MIN_VALUE',
  'SUPPLIER_MAX_VALUE',
]);

export const NODE_ENV = process.env.NODE_ENV || '';

export const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';

export const daoFee = BigNumber.from(process.env.DAO_FEE) || BigNumber.from(0);

export const daoLif = BigNumber.from(process.env.DAO_LIF) || BigNumber.from(0);

export const inflationCoefficient = BigNumber.from(process.env.INFLATION) || BigNumber.from(0);

export const mainnetBaseFee = BigNumber.from(process.env.MAINNET_BASE_FEE) || BigNumber.from(0);

export const mainnetAccountsNumber = Number(process.env.MAINNET_ACCOUNTS_NUMBER) || 0;

export const mainnetDefaultLif =
  BigNumber.from(process.env.MAINNET_DEFAULT_LIF) || BigNumber.from(0);

export const mainnetDefaultStable =
  BigNumber.from(process.env.MAINNET_DEFAULT_STABLE) || BigNumber.from(0);

export const mainnetAccountsEth =
  BigNumber.from(process.env.MAINNET_ACCOUNTS_ETH) || BigNumber.from(0);

export const l3BaseFee = BigNumber.from(process.env.L3_BASE_FEE) || BigNumber.from(0);

export const bridgeLif = BigNumber.from(process.env.BRIDGE_LIF) || BigNumber.from(0);

export const supplierNumber = Number(process.env.SUPPLIER_NUMBER) || 1;

export const supplierMinValue = BigNumber.from(process.env.SUPPLIER_MIN_VALUE) || BigNumber.from(0);

export const supplierMaxValue = BigNumber.from(process.env.SUPPLIER_MAX_VALUE) || BigNumber.from(0);
