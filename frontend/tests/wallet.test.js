import test from 'node:test';
import assert from 'node:assert/strict';
import { connectWallet, CHAIN_ID, NETWORK, assertExecution } from '../src/wallet.js';
const address = '0x1234567890123456789012345678901234567890';
function wallet({ chain = CHAIN_ID, unknown = false, reject = false, stuck = false, accounts = [address] } = {}) {
  const calls = [];
  return { calls, async request({ method, params }) {
    calls.push({ method, params });
    if (method.startsWith('wallet_') && method.includes('Snap')) throw new Error("method [wallet_getSnaps] doesn't has corresponding handler");
    if (method === 'eth_requestAccounts') { if (reject) throw { code: 4001 }; return accounts; }
    if (method === 'eth_accounts') return accounts;
    if (method === 'eth_chainId') return chain;
    if (method === 'wallet_switchEthereumChain') {
      if (unknown) { unknown = false; throw { code: 4902 }; }
      if (!stuck) chain = params[0].chainId;
      return null;
    }
    if (method === 'wallet_addEthereumChain') return null;
    if (method === 'eth_sendTransaction') return '0x' + 'a'.repeat(64);
    throw new Error('Unexpected wallet method: ' + method);
  }};
}
test('wallet without Snaps connects on Stable Studionet', async () => {
  const provider = wallet();
  const session = await connectWallet(provider);
  assert.equal(session.account, address);
  assert.equal(session.client.chain.id, 61999);
  assert.deepEqual(provider.calls.map(c => c.method), ['eth_requestAccounts', 'eth_chainId', 'eth_chainId', 'eth_accounts']);
});
test('unknown chain is added with canonical RPC then switched', async () => {
  const provider = wallet({ chain: '0x1', unknown: true });
  await connectWallet(provider);
  assert.deepEqual(provider.calls.find(c => c.method === 'wallet_addEthereumChain').params, [NETWORK]);
  assert.equal(provider.calls.filter(c => c.method === 'wallet_switchEthereumChain').length, 2);
});
test('existing chain switches without adding', async () => {
  const provider = wallet({ chain: '0x1' });
  await connectWallet(provider);
  assert.equal(provider.calls.some(c => c.method === 'wallet_addEthereumChain'), false);
});
test('reject, empty account, missing wallet and failed switch do not connect', async () => {
  await assert.rejects(connectWallet(wallet({ reject: true })), e => e.code === 4001);
  await assert.rejects(connectWallet(wallet({ accounts: [] })), /No wallet account/);
  await assert.rejects(connectWallet(null), /No wallet found/);
  await assert.rejects(connectWallet(wallet({ chain: '0x1', stuck: true })), /61999/);
});
test('SDK write uses the selected standard provider without Snaps', async () => {
  const provider = wallet();
  const { client } = await connectWallet(provider);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const { method, id } = JSON.parse(options.body);
    const results = { eth_getTransactionCount: '0x0', eth_estimateGas: '0x30d40', eth_gasPrice: '0x0' };
    assert.ok(method in results, 'Unexpected RPC method ' + method);
    return { json: async () => ({ jsonrpc: '2.0', id, result: results[method] }) };
  };
  try {
    const hash = await client.writeContract({ address, functionName: 'assess_claim', args: ['example'], value: 0n });
    assert.equal(hash, '0x' + 'a'.repeat(64));
    const tx = provider.calls.find(c => c.method === 'eth_sendTransaction').params[0];
    assert.equal(tx.from.toLowerCase(), address);
    assert.equal(tx.chainId, CHAIN_ID);
    assert.equal(tx.value, '0x0');
    assert.ok(tx.data.startsWith('0x'));
  } finally { globalThis.fetch = originalFetch; }
});
test('finalized execution failures never display success', () => {
  assert.doesNotThrow(() => assertExecution({ tx_execution_succeeded: true }));
  assert.throws(() => assertExecution({ tx_execution_succeeded: false }), /without confirmed/);
  assert.throws(() => assertExecution({ status: 7 }), /without confirmed/);
});
