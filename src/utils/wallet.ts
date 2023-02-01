import { Wallet, utils } from 'ethers';

export const generateAccounts = (count: number): string[] => {
  const wallet = Wallet.createRandom();
  const node = utils.HDNode.fromMnemonic(wallet.mnemonic.phrase);
  const accounts: string[] = [];
  for (let i = 0; i < count; i++) {
    accounts.push(node.derivePath(`m/44'/60'/0'/0/${i}`).address);
  }
  return accounts;
};
