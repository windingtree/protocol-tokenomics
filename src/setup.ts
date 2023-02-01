import { constants } from 'ethers';
import { generateAccounts } from './utils/wallet';
import { Chain } from './chain';
import { Token } from './token';
import { Bridge } from './bridge';
import { Contract } from './contract';
import {
  mainnetBaseFee,
  mainnetAccountsNumber,
  mainnetAccountsEth,
  mainnetDefaultLif,
  l3BaseFee,
  inflationCoefficient,
  daoFee,
} from './config';
import { Logger } from './utils/logger';

const logger = Logger('Setup');

export interface Setup {
  mainnet: Chain;
  l3: Chain;
  lifToken: Token;
  stableToken: Token;
  l3LifToken: Token;
  l3StableToken: Token;
  bridge: Bridge;
  contract: Contract;
}

export const setup = async () => {
  logger.info('Start setup');
  logger.info('Number of accounts on Mainnet:', mainnetAccountsNumber);
  const [mainnetFeeRecipient, l3FeeRecipient, dao, ...mainnetAccounts] = generateAccounts(mainnetAccountsNumber);

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
    new Token(
      'LIF',
      mainnetAccounts.map((a) => [a, mainnetDefaultLif]),
    ),
  );
  logger.info('Mainnet LIF token deployed at:', lifToken);

  // Setup Mainnet STABLE token
  const stableToken = mainnet.deployToken(
    new Token(
      'STABLE',
      mainnetAccounts.map((a) => [a, mainnetDefaultLif]),
    ),
  );
  logger.info('Mainnet STABLE token deployed at:', stableToken);

  const l3 = new Chain('l3', l3BaseFee, l3FeeRecipient);
  logger.info('L3 chain setup done');
  logger.info('L3 chain base fee:', l3BaseFee.toString());
  logger.info('L3 chain fee recipient:', l3FeeRecipient);

  // Setup L3 LIF token
  const l3LifToken = l3.deployToken(new Token('LIF', []));
  logger.info('L3 LIF token deployed at:', l3LifToken);

  // Setup L3 STABLE token
  const l3StableToken = l3.deployToken(new Token('STABLE', []));
  logger.info('L3 STABLE token deployed at:', l3StableToken);

  // Setup bridge
  logger.info('DAO address:', dao);
  const bridge = new Bridge([mainnet, l3]);
  logger.info('Bridge setup done');
  bridge.registerPair(
    {
      chainId: mainnet.id,
      address: lifToken,
    },
    {
      chainId: l3.id,
      address: l3LifToken,
    },
  );
  logger.info('Registered bridged pair LIF (Mainnet) -> LIF (L3)');
  bridge.registerPair(
    {
      chainId: mainnet.id,
      address: stableToken,
    },
    {
      chainId: l3.id,
      address: l3StableToken,
    },
  );
  logger.info('Registered bridged pair STABLE (Mainnet) -> STABLE (L3)');

  // Setup the protocol smart contract
  const contract = l3.deployContract(l3LifToken, inflationCoefficient, daoFee, dao);
  logger.info('The protocol smart contract deployed at:', contract);

  return {
    mainnet,
    l3,
    lifToken,
    stableToken,
    l3LifToken,
    l3StableToken,
    bridge,
    contract,
  };
};
