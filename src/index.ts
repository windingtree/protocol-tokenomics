import { Logger } from './utils/logger';
import { setup } from './setup';

const logger = Logger('index');

process.once('unhandledRejection', async (error) => {
  logger.error(error);
  process.exit(1);
});

const main = async (): Promise<void> => {
  // Graceful Shutdown handler
  const shutdown = async () => {
    process.exit(0);
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  const {
    mainnetFeeRecipient,
    l3FeeRecipient,
    dao,
    mainnetAccounts,
    mainnet,
    l3,
    lifToken,
    stableToken,
    l3LifToken,
    l3StableToken,
    bridge,
    contract,
  } = await setup();
};

export default main().catch(async (error) => {
  logger.info('Application exit', error);
  process.exit(1);
});
