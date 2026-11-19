# EcoVerdict — Environmental Claims Docket

EcoVerdict records public environmental claims, the evidence cited for them and GenLayer validator judgments on Stable Studionet.

**Milestone v2** adds supplemental evidence and a second consensus review under the same claim ID. The filer can add up to three new HTTPS sources once. Anyone can trigger reassessment. The original and supplemental sources are considered together, and both decisions stay visible in the public record.

- [Current v2 contract on Stable Studionet (chain 61999)](https://explorer-studio.genlayer.com/address/0x6e391FcC542B31564C7c423eBD31918f3a372479)
- [Six demonstration cases and their chain records](evidence/v2/DEMO_CASES.md)
- [Milestone scope, accepted baseline and reproduction](MILESTONE.md)
- [v2 chain verification](evidence/v2/VERIFICATION.md)
- [Official website](https://zuotu295.github.io/eco-verdict/)
- [Original release and historical evidence](https://github.com/zuotu295/eco-verdict/tree/90b14bbc7fe593a7d6b2c160ceab901b144c51a0)

## Case flow

1. File a subject, the published wording and one to three sources.
2. Run the initial assessment. GenLayer validators independently fetch the sources and agree on a verdict and reason category.
3. The original filer can submit one supplemental source set for the same claim.
4. Run supplemental review. The docket displays both decisions with their respective source lists, categories and summaries.

The contract judges the public URLs supplied for a case. A ruling describes what the cited sources support, and a live reassessment may see updated content at those URLs.

## Run the frontend

```bash
cd frontend
npm ci
npm test
npm run build
npm run preview
```

The Vite build targets the v2 Studionet address defined in `frontend/src/deployment.js`. Writes use an injected Ethereum-compatible wallet on chain 61999. The contract has no payment or escrow flow.

## License

[MIT](LICENSE).
