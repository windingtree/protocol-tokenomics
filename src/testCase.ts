import { BigNumber, constants } from 'ethers';
import { Bridge } from './bridge';
import { Chain } from './chain';
import { mainnetDefaultStable } from './config';
import { Setup } from './setup';
import { Supplier } from './supplier';
import { Token } from './token';
import { Logger } from './utils/logger';

const logger = Logger('testCase');

/**
Every cycle:

On every buyer:

- Move STABLE tokens though the bridge
- Randomly select a supplier and request an offer

Buyer: on offer

- Create a deal

On every supplier:

- Wait for an offer request

Supplier: on request:

- Create an offer
- Claim the deal

 */

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

export const testCase = async (setup: Setup): Promise<void> => {
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

  while (cycleAccounts.size > 0) {
    for (const account of cycleAccounts) {
      const ok = await dealFlow(mainnet, l3, contract, account, suppliers, bridge);
      if (!ok) {
        cycleAccounts.delete(account);
      }
    }
  }
  logger.info('Test case finished');
};
