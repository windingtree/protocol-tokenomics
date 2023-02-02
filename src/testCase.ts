import { BigNumber, constants } from 'ethers';
import { Bridge } from './bridge';
import { Chain } from './chain';
import { mainnetDefaultStable } from './config';
import { Setup } from './setup';
import { Supplier } from './supplier';
import { Token } from './token';
import { Logger } from './utils/logger';

const logger = Logger('testCase');

export interface Snapshot {
  mainnetBridgeLif: string;
  mainnetBridgeStable: string;
  mainnetDaoLif: string;
  l3BridgeLif: string;
  l3DaoLif: string;
  l3Fee: string;
  l3BuyersAccounts: string;
}

export const dealFlow = async (
  mainnet: Chain,
  l3: Chain,
  contract: string,
  buyer: string,
  suppliers: Supplier[],
  bridge: Bridge,
): Promise<boolean> => {
  try {
    // Select a supplier
    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];

    // Request the supplier
    const offer = supplier.request();

    // Check if balance allow to send txs
    const balance = mainnet.balanceOfAddress(buyer);
    if (balance.lt(mainnet.fee)) {
      return false;
    }

    // Check if funds to pay enough
    const pairedStable = bridge.getPairedToken(l3.id, offer.token);
    const stableToken = mainnet.getContract<Token>(pairedStable);
    const balanceStable = stableToken.balanceOf(buyer);
    if (balanceStable.lt(offer.value)) {
      return false;
    }

    // Move STABLE tokens to L3
    await bridge.enter(buyer, pairedStable, offer.value);

    // Create a deal
    const dealTx = l3.sendTransaction({
      from: buyer,
      value: BigNumber.from(0),
      data: {
        address: contract,
        function: 'deal',
        arguments: [buyer, offer],
      },
    });
    logger.info(`Buyer ${buyer} sent a deal tx: #${dealTx} using offer: ${offer.id}`);
    await l3.mempool.wait(dealTx);
    logger.info(`Deal on the offer: ${offer.id} is done, waiting for claim`);
  } catch (error) {
    logger.error(error);
    return false;
  }

  return true;
};

export const snapshot = (setup: Setup) => {
  const { mainnet, l3, lifToken, stableToken, bridge, dao, l3FeeRecipient, mainnetAccounts } =
    setup;

  // Balances Mainnet
  const mainnetLif = mainnet.getContract<Token>(lifToken);
  const mainnetStable = mainnet.getContract<Token>(stableToken);
  const mainnetBridgeLif = mainnetLif.balanceOf(bridge.wallet);
  const mainnetBridgeStable = mainnetStable.balanceOf(bridge.wallet);
  const mainnetDaoLif = mainnetLif.balanceOf(dao);

  // Balances L3
  const l3BridgeLif = l3.balanceOfAddress(bridge.wallet);
  const l3DaoLif = l3.balanceOfAddress(dao);
  const l3Fee = l3.balanceOfAddress(l3FeeRecipient);
  const l3BuyersAccounts = mainnetAccounts
    .map((a) => l3.balanceOfAddress(a))
    .reduce((a, v) => a.add(v), BigNumber.from(0));

  return {
    mainnetBridgeLif: mainnetBridgeLif.toString(),
    mainnetBridgeStable: mainnetBridgeStable.toString(),
    mainnetDaoLif: mainnetDaoLif.toString(),
    l3BridgeLif: l3BridgeLif.toString(),
    l3DaoLif: l3DaoLif.toString(),
    l3Fee: l3Fee.toString(),
    l3BuyersAccounts: l3BuyersAccounts.toString(),
  };
};

export const testCase = async (setup: Setup): Promise<Snapshot[]> => {
  const { mainnet, l3, contract, stableToken, mainnetAccounts, suppliers, bridge } = setup;

  // Top-up mainnet account with STABLE tokens
  const topUpTxs = mainnetAccounts.map((a) =>
    mainnet.sendTransaction({
      from: constants.AddressZero,
      value: BigNumber.from(0),
      data: {
        address: stableToken,
        function: 'mint',
        arguments: [constants.AddressZero, a, mainnetDefaultStable],
      },
    }),
  );
  await Promise.all(topUpTxs.map((tx) => mainnet.mempool.wait(tx)));
  logger.info(
    `Mainnet accounts are loaded with STABLE tokens in amount ${mainnetDefaultStable} each`,
  );

  // Run deals cycle
  const cycleAccounts = new Set(mainnetAccounts);

  // Snapshots
  const snaps: Snapshot[] = [];

  while (cycleAccounts.size > 0) {
    snaps.push(snapshot(setup));

    for (const account of cycleAccounts) {
      const ok = await dealFlow(mainnet, l3, contract, account, suppliers, bridge);
      if (!ok) {
        cycleAccounts.delete(account);
      }
    }
  }
  logger.info('Test case finished');

  return snaps;
};
