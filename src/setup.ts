import { constants } from 'ethers';
import { generateAccounts } from './utils/wallet';
import { Chain } from './chain';
import { Bridge } from './bridge';
import {
  mainnetBaseFee,
  mainnetAccountsNumber,
  mainnetAccountsEth,
  mainnetDefaultLif,
  l3BaseFee,
  inflationCoefficient,
  daoFee,
  daoLif,
  bridgeLif,
  supplierNumber,
  supplierMaxValue,
  supplierMinValue,
} from './config';
import { Supplier } from './supplier';
import { Logger } from './utils/logger';

const logger = Logger('Setup');

export interface Setup {
  mainnetFeeRecipient: string;
  l3FeeRecipient: string;
  dao: string;
  mainnetAccounts: string[];
  mainnet: Chain;
  l3: Chain;
  lifToken: string;
  stableToken: string;
  l3StableToken: string;
  bridge: Bridge;
  contract: string;
  suppliers: Supplier[];
}

export const setup = async () => {
  logger.info('Start setup');
  logger.info('Number of accounts on Mainnet:', mainnetAccountsNumber);
  const [mainnetFeeRecipient, l3FeeRecipient, dao, ...mainnetAccounts] =
    generateAccounts(mainnetAccountsNumber);

  // Setup Mainnet
  const mainnet = new Chain('mainnet', mainnetBaseFee, mainnetFeeRecipient);
  logger.info('Mainnet chain setup done');
  logger.info('Mainnet chain base fee:', mainnetBaseFee.toString());
  logger.info('Mainnet chain fee recipient:', mainnetFeeRecipient);

  // Top-up account
  logger.info('Mainnet mainnetFeeRecipient credited ETH:', mainnetAccountsEth.toString());
  mainnetAccounts.map((a) => mainnet.send(constants.AddressZero, a, mainnetAccountsEth));
  logger.info('Mainnet accounts credited ETH');

  // Setup Mainnet LIF token
  const lifToken = mainnet.deployToken(
    'LIF',
    mainnetAccounts.map((a) => [a, mainnetDefaultLif]),
  );
  logger.info('Mainnet LIF token deployed at:', lifToken);

  // Setup Mainnet STABLE token
  const stableToken = mainnet.deployToken(
    'STABLE',
    mainnetAccounts.map((a) => [a, mainnetDefaultLif]),
  );
  logger.info('Mainnet STABLE token deployed at:', stableToken);

  const l3 = new Chain('l3', l3BaseFee, l3FeeRecipient);
  logger.info('L3 chain setup done');
  logger.info('L3 chain base fee:', l3BaseFee.toString());
  logger.info('L3 chain fee recipient:', l3FeeRecipient);

  // Setup L3 STABLE token
  const l3StableToken = l3.deployToken('STABLE', []);
  logger.info('L3 STABLE token deployed at:', l3StableToken);

  // Setup bridge
  logger.info('DAO address:', dao);
  const bridge = new Bridge(mainnet, l3, bridgeLif);
  logger.info('Bridge setup done');
  bridge.registerPair(mainnet.id, stableToken, l3StableToken);
  logger.info('Registered bridged pair STABLE (Mainnet) -> STABLE (L3)');
  bridge.registerPair(l3.id, l3StableToken, stableToken);
  logger.info('Registered bridged pair STABLE (L3) -> STABLE (Mainnet)');

  // Top-up the DAO with LIF on L3
  l3.send(constants.AddressZero, dao, daoLif);
  logger.info(`DAO loaded with ${daoLif.toString()} LIF L3`);

  // Credit bridge with LIF on L3 from DAO
  const bridgeAccount = bridge.wallet;
  l3.send(dao, bridgeAccount, daoLif);
  logger.info(`Bridge credited with ${daoLif.toString()} LIF from DAO on L3`);

  // Setup the protocol smart contract
  const contract = l3.deployContract(inflationCoefficient, daoFee, dao);
  logger.info('The protocol smart contract deployed at:', contract);

  // Setup suppliers
  const suppliers = Array(supplierNumber)
    .fill(null)
    .map(() => new Supplier(l3, [l3StableToken], supplierMinValue, supplierMaxValue, contract));
  const suppliersIds = suppliers.map((s) => s.id);
  logger.info(`Setup of ${supplierNumber} is done`, suppliersIds);
  suppliers.map((s) => l3.send(constants.AddressZero, s.account, mainnetAccountsEth));
  logger.info('Suppliers accounts credited LIF');

  return {
    mainnetFeeRecipient,
    l3FeeRecipient,
    dao,
    mainnetAccounts,
    mainnet,
    l3,
    lifToken,
    stableToken,
    l3StableToken,
    bridge,
    contract,
    suppliers,
  };
};
