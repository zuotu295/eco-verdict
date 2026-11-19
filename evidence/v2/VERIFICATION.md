# EcoVerdict v2 verification

The Stable Studionet acceptance flow passed. It followed one case from filing through a supplemental ruling. All five chain transactions finalized with successful execution.

| Step | Observed result | Explorer |
| --- | --- | --- |
| Deploy v2 | Protocol `eco-verdict-2` | [`0x19822d45…ddb896`](https://explorer-studio.genlayer.com/tx/0x19822d458956837ebb760c6c42270f5fca86e27d150f5c194fc59578e6ddb896) |
| File claim | Case `FILED` | [`0x3b70917b…da10b5`](https://explorer-studio.genlayer.com/tx/0x3b70917bd7c4fe3c7b7e0ccc4349925a6c997baa9177f44dcc0cc05176da10b5) |
| Initial assessment | `UNVERIFIED / insufficient_evidence` | [`0x13e8a1ac…cdc17b`](https://explorer-studio.genlayer.com/tx/0x13e8a1acb86a2a2c3a2eb71f41cfc2b5692dfea2d06fae93c22b55fe88cdc17b) |
| Submit supplemental evidence | `REVIEW_PENDING`, first round preserved | [`0x21eaa7b4…d4ca9c`](https://explorer-studio.genlayer.com/tx/0x21eaa7b42ec8559e61b3d3ce73881fdf4cee3dcf8bde24c177b4f9c1dcd4ca9c) |
| Supplemental assessment | `GREEN / supported`, both rounds preserved | [`0x925f91de…b50f6a`](https://explorer-studio.genlayer.com/tx/0x925f91de3a072f08a352076a929befda5c2c906f762ea784362c96328db50f6a) |

[Machine-readable evidence](chain.json) preserves the source digest, transaction hashes and the initial, pending and final readbacks. The final record preserves the original case ID, wording, filer and first ruling. Its second round lists both URLs.

From `frontend/`, run `node scripts/verify-review.mjs` after `npm ci` to independently verify the deployed source, receipts and latest finalized record without a wallet.

Local verification passed 22 contract stand-in tests, two direct-mode GenVM smoke tests, six wallet tests, contract structure checks, GenVM lint, the production build and a frontend DOM smoke test with fixture chain data. The direct-mode run reused the cached v0.2.16 SDK artifact after the default release download returned HTTP 404. The first live attempt encountered a nonce RPC error before filing. The successful run reused the empty deployed instance.
