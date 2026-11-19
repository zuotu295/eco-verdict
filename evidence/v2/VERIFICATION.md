# EcoVerdict v2 verification

Contract source SHA-256 is `45c195789ed805730646d8656286e65cfcb6ad9853adc443e84dd8506a22e23e`.

| Step | Status | Evidence |
| --- | --- | --- |
| Deploy v2 | FINALIZED, execution succeeded | [Deployment transaction](https://explorer-studio.genlayer.com/tx/0x19822d458956837ebb760c6c42270f5fca86e27d150f5c194fc59578e6ddb896) |
| Protocol readback | `eco-verdict-2` | [Contract address](https://explorer-studio.genlayer.com/address/0x6e391FcC542B31564C7c423eBD31918f3a372479) |
| File claim | FINALIZED, execution succeeded | [Filing transaction](https://explorer-studio.genlayer.com/tx/0x3b70917bd7c4fe3c7b7e0ccc4349925a6c997baa9177f44dcc0cc05176da10b5) |
| Assess, supplement, reassess | Acceptance pending | Awaiting live verification. |

Local verification passed 22 contract stand-in tests, the contract structure checks, six wallet tests, the production build and a frontend DOM smoke test with fixture chain data. GenVM lint and all three SDK checks passed. Both direct-mode GenVM smoke tests passed using the cached v0.2.16 SDK artifact after the default release download returned HTTP 404.
