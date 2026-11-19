# Deploying EcoVerdict v2

[Current v2 contract on Stable Studionet (chain 61999)](https://explorer-studio.genlayer.com/address/0x6e391FcC542B31564C7c423eBD31918f3a372479) is the deployment used by the official site. The protocol identifier is `eco-verdict-2`.

See [MILESTONE.md](MILESTONE.md) for the contract, evidence and live acceptance command. The original deployment instructions and proofs are [in the accepted baseline](https://github.com/zuotu295/eco-verdict/blob/90b14bbc7fe593a7d6b2c160ceab901b144c51a0/DEPLOY.md).

The site is served from the root of the `gh-pages` branch. From `frontend/`, run `npm ci`, `npm test` and `npm run build`. Publish the contents of `frontend/dist/` to that branch after the live acceptance flow passes. Vite generates relative asset paths for the existing repository site. Verify that the published page links to the v2 contract, loads finalized claim data, and displays both rounds of the acceptance case.
